import { GoogleGenAI } from "@google/genai";
import { simpleRagService as ragService, type AccidentCase } from "./simple-rag-service";
import { chromaDBService } from "./chromadb-service";
import * as fs from 'fs';
import * as path from 'path';
import {
  resolveProfile,
  buildTargetedSearchQuery,
  shouldIncludeContent,
  applyHybridScoring,
  inferEquipmentTags,
  inferRiskTags,
  type EquipmentInfo,
  type SearchItem,
  type Profile,
  type WorkType
} from './profiles';

// ===== Adaptive Backoff Levels =====
// strict → relax1 → relax2
const BACKOFF = [
  {
    label: 'strict',
    quantile: { incident: 0.85, education: 0.80, regulation: 0.80 },
    cap:      { incident: 0.50, education: 0.35, regulation: 0.40 },
    floor:    { incident: 0.10, education: 0.08, regulation: 0.08 },
    gating: {
      minSetsMatched: 3,
      minKeywordHits: { incident: 3, education: 1, regulation: 1 },
      minVectorScore: 0.18,
      enforceTitleEquip: true,
      recencyYears: 10
    }
  },
  {
    label: 'relax1',
    quantile: { incident: 0.75, education: 0.70, regulation: 0.75 },
    cap:      { incident: 0.45, education: 0.32, regulation: 0.38 },
    floor:    { incident: 0.08, education: 0.06, regulation: 0.06 },
    gating: {
      minSetsMatched: 2,
      minKeywordHits: { incident: 2, education: 1, regulation: 1 },
      minVectorScore: 0.14,
      enforceTitleEquip: false,
      recencyYears: 20
    }
  },
  {
    label: 'relax2',
    quantile: { incident: 0.60, education: 0.60, regulation: 0.65 },
    cap:      { incident: 0.40, education: 0.30, regulation: 0.35 },
    floor:    { incident: 0.05, education: 0.05, regulation: 0.05 },
    gating: {
      minSetsMatched: 1,
      minKeywordHits: { incident: 1, education: 0, regulation: 0 },
      minVectorScore: 0.10,
      enforceTitleEquip: false,
      recencyYears: 0 // 0 = disable
    }
  }
] as const;

// Keep legacy TUNING for backward compatibility
const TUNING = {
  categoryTargets: {
    incident:  { min: 3, max: 6 },   // 사고사례
    education: { min: 2, max: 5 },   // 교육자료
    regulation:{ min: 3, max: 6 }    // 법령
  },
  diversity: {
    maxPerDoc: 1,                       // keep at most 1 chunk per doc
    dedupKeys: ["docId", "url", "title"]
  }
} as const;

// ---------- Diagnostics ----------
function dbgCount<T>(label: string, list: T[]) {
  const n = Array.isArray(list) ? list.length : 0;
  console.log(`[dbg] ${label}:`, n);
  return list;
}

// ---------- Type normalization ----------
function normType(m: any) {
  const s = (m?.type || m?.sourceType || '').toLowerCase();
  if (s === 'accident') return 'incident';
  return s;
}

// ---------- Negatives for keyword-only queries ----------
function applyNegatives(query: string, negatives: string[]): string {
  return negatives.reduce((s, n) => `${s} -${n}`, query);
}

// ---------- Upstream where (relaxed) ----------
function buildRelaxedWhere(expectedTags: string[] | undefined) {
  const tags = (expectedTags || []).filter(Boolean);
  if (!tags.length) return undefined; // no upstream filter when none
  return {
    $or: [
      { tags: { $containsAny: tags } },
      { tags: { $exists: false } },
      { industry: { $exists: false } }
    ]
  };
}

// ---------- Dedup ----------
function dedupById<T extends { metadata?: any; document?: string }>(arr: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of arr) {
    if (x) {
      const id = x.metadata?.id || x.document || JSON.stringify(x);
      m.set(id, x);
    }
  }
  return Array.from(m.values());
}

// ---------- Thresholds & fallbacks ----------
function computeThreshold(scores: number[], kind: 'incident' | 'education' | 'regulation') {
  if (!scores.length) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.70); // pass top 30%
  const p = sorted[idx] ?? 0;
  const cap = kind === 'education' ? 0.25 : 0.35;
  return Math.min(p, cap);
}

function applyThresholdWithFallback(list: any[], kind: 'incident' | 'education' | 'regulation') {
  const scores = list.map(x => x.hybridScore ?? 0);
  let th = computeThreshold(scores, kind);
  let out = list.filter(x => (x.hybridScore ?? 0) >= th);
  if (out.length === 0) out = list.filter(x => (x.hybridScore ?? 0) >= 0);
  if (out.length === 0 && list.length) out = list.sort((a,b)=>(b.hybridScore??0)-(a.hybridScore??0)).slice(0, Math.min(5, list.length));
  return out;
}

// ---------- Non-empty safeguard ----------
function ensureNonEmpty<T>(label: string, arr: T[], fallback: () => T[]): T[] {
  if (arr.length > 0) return arr;
  console.warn(`[warn] ${label} empty → fallback`);
  return fallback();
}

// ---------- Precision Control Helpers ----------
function quantile(sortedAsc: number[], q: number) {
  if (!sortedAsc.length) return 0;
  const pos = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(sortedAsc.length * q)));
  return sortedAsc[pos] ?? 0;
}

function normalizeStr(x?: string) { return (x || '').toLowerCase().trim(); }

function getMetaStr(m: any, k: string) { return normalizeStr(m?.[k]); }

function toTextBlobForGating(r: any) {
  return [normalizeStr(r.metadata?.title), normalizeStr(r.document)].join(' ');
}

function parseYear(maybeDate: string): number | undefined {
  if (!maybeDate) return undefined;
  const m = maybeDate.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : undefined;
}

function isRecentEnough(r: any, years: number): boolean {
  if (!years) return true;
  const y = parseYear(getMetaStr(r.metadata, 'date') || getMetaStr(r.metadata, 'year'));
  if (!y) return true; // no date → keep
  const now = new Date().getFullYear();
  return (now - y) <= years;
}

function countHits(text: string, needles: string[]): number {
  const s = text;
  let hits = 0;
  for (const n of (needles || [])) {
    const t = normalizeStr(n);
    if (!t) continue;
    if (s.includes(t)) hits += 1;
  }
  return hits;
}

function anyHit(text: string, needles: string[]) {
  return countHits(text, needles) > 0;
}

// Legacy gating function - now replaced by adaptive system
function mustPassGating(r: any, equipmentInfoObj: any, workType: any, profile: any) {
  // Use the most relaxed settings from BACKOFF for legacy compatibility
  const relaxedLevel = BACKOFF[BACKOFF.length - 1];
  return mustPassGatingWithLevel(r, equipmentInfoObj, workType, profile, relaxedLevel);
}

function diversifyAndTrim(list: any[], maxPerDoc: number, keys: string[]) {
  if (!Array.isArray(list) || !list.length) return [];
  const buckets = new Map<string, any[]>();
  for (const r of list) {
    const m = r.metadata || {};
    const key = keys.map(k => normalizeStr(m[k])).find(Boolean) || normalizeStr(r.id);
    const arr = buckets.get(key) || [];
    if (arr.length < maxPerDoc) arr.push(r);
    buckets.set(key, arr);
  }
  // flatten preserving order
  const out: any[] = [];
  buckets.forEach(arr => out.push(...arr));
  return out;
}

function computeStrictThreshold(scores: number[], kind: 'incident'|'education'|'regulation') {
  if (!scores.length) return 0;
  const sorted = [...scores].sort((a,b)=>a-b);
  const q = 0.8;
  const cap = kind === 'education' ? 0.35 : 0.4;
  const floor = 0.1;
  const p = quantile(sorted, q);
  return Math.max(floor, Math.min(p, cap));
}

// ===== Adaptive Backoff Helpers =====
function computeThresholdWithLevel(scores: number[], kind: 'incident'|'education'|'regulation', lvl: typeof BACKOFF[number]) {
  if (!scores.length) return 0;
  const sorted = [...scores].sort((a,b)=>a-b);
  const q = (lvl.quantile as any)[kind];
  const cap = (lvl.cap as any)[kind];
  const floor = (lvl.floor as any)[kind];
  const pos = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)));
  const p = sorted[pos] ?? 0;
  return Math.max(floor, Math.min(p, cap));
}

function mustPassGatingWithLevel(r: any, equipmentInfoObj: any, workType: any, profile: any, lvl: typeof BACKOFF[number]) {
  const text = [String(r?.metadata?.title || ''), String(r?.document || '')].join(' ').toLowerCase();
  const eqTokens = (equipmentInfoObj?.name ? equipmentInfoObj.name.split(/\s+/) : [])
    .concat(equipmentInfoObj?.tags || []).map((s: any)=>String(s).toLowerCase());
  const wtTokens = (workType?.name ? workType.name.split(/\s+/) : []).map((s: any)=>String(s).toLowerCase());
  const rkTokens = (equipmentInfoObj?.riskTags || []).map((s: any)=>String(s).toLowerCase());

  const sets = {
    equipment: eqTokens.some(t => t && text.includes(t)) ? 1 : 0,
    workType:  wtTokens.some(t => t && text.includes(t)) ? 1 : 0,
    risk:      rkTokens.some(t => t && text.includes(t)) ? 1 : 0
  };
  const matchedSets = Object.values(sets).reduce((a,b)=>a+b,0);
  if (matchedSets < lvl.gating.minSetsMatched) return false;

  const kind = normType(r.metadata) as 'incident'|'education'|'regulation'|string;
  const kwHits = (profile.keywords || []).reduce((n: number, k: string)=> n + (k && text.includes(k.toLowerCase()) ? 1 : 0), 0);
  const minKw = (lvl.gating.minKeywordHits as any)[kind] ?? 0;
  if (kwHits < minKw) return false;

  const v = Number(r.vectorScore ?? r.score ?? r.similarity ?? 0);
  if (v < lvl.gating.minVectorScore && matchedSets < (lvl.gating.minSetsMatched + 1)) return false;

  if (lvl.gating.enforceTitleEquip) {
    const title = String(r?.metadata?.title || '').toLowerCase();
    if (title && !eqTokens.some((t: any) => t && title.includes(String(t)))) return false;
  }

  // recency: 0 disables
  if (lvl.gating.recencyYears && !isRecentEnough(r, lvl.gating.recencyYears)) return false;

  return true;
}

// ===== Adaptive Category Processor =====
function processCategoryAdaptive(
  preList: any[],
  kind: 'incident'|'education'|'regulation',
  resolvedProfile: Profile,
  equipmentInfoObj: EquipmentInfo,
  workType?: WorkType,
  minOut = 2,
  maxOut = 6
) {
  console.log(`[ADAPTIVE] Processing ${kind} with ${preList.length} candidates, targets: ${minOut}-${maxOut}`);
  
  if (!preList || preList.length === 0) {
    console.log(`[ADAPTIVE] ${kind} - No input candidates, returning empty`);
    return [];
  }

  // ENHANCED FALLBACK: Skip strict gating for better content recall
  console.log(`[ADAPTIVE] ${kind} ENHANCED FALLBACK - applying relaxed filtering for better recall`);
  
  // Apply only basic scoring without strict gating
  const scored = preList.map((r: any) => {
    const base = applyHybridScoring({
      id: r.metadata?.id || r.document || 'unknown',
      title: r.metadata?.title,
      text: r.document,
      content: r.document,
      metadata: r.metadata,
      vectorScore: r.vectorScore ?? r.score ?? r.similarity
    } as SearchItem, resolvedProfile, equipmentInfoObj, workType);
    return { ...r, hybridScore: base };
  });
  
  console.log(`[ADAPTIVE] ${kind} scored all ${scored.length} candidates`);
  
  // Sort by hybrid score
  const sorted = scored.sort((a,b)=>(b.hybridScore??0)-(a.hybridScore??0));
  
  // For debugging, show score distribution
  const scores = sorted.map(x => x.hybridScore ?? 0);
  if (scores.length > 0) {
    console.log(`[ADAPTIVE] ${kind} score range: ${Math.min(...scores).toFixed(3)}-${Math.max(...scores).toFixed(3)}`);
  }
  
  // Apply very relaxed threshold - just take top candidates
  const relaxedThreshold = 0.01; // Very low threshold to ensure content gets through
  let top = sorted.filter(x => (x.hybridScore ?? 0) >= relaxedThreshold);
  console.log(`[ADAPTIVE] ${kind} passed relaxed threshold (${relaxedThreshold}): ${top.length}`);

  // If still no results, take the top candidates regardless of score
  if (top.length === 0 && sorted.length > 0) {
    console.log(`[ADAPTIVE] ${kind} EMERGENCY FALLBACK - taking top candidates regardless of score`);
    top = sorted.slice(0, Math.max(minOut, 3));
  }

  // diversity trimming - but more lenient
  top = diversifyAndTrim(top, 2, ['docId','url','title']); // Allow 2 per document instead of 1
  console.log(`[ADAPTIVE] ${kind} after diversity: ${top.length}`);

  // cap and ensure we get something
  const result = top.slice(0, maxOut);
  console.log(`[ADAPTIVE] ${kind} ENHANCED FALLBACK returned ${result.length} results`);
  
  return result;
}

// Timing utilities for performance analysis
const t0 = () => performance.now();
const ms = (s: number) => `${s.toFixed(1)}ms`;
async function timeit<T>(name: string, f: () => Promise<T>): Promise<T> {
  const s = t0();
  try { 
    return await f(); 
  } finally { 
    console.log(`[AIService][timing] ${name}: ${ms(t0() - s)}`); 
  }
}

// Using Google Gemini for AI-powered safety analysis
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface SafetyAnalysis {
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  recommendations: string[];
  procedureAdjustments: string[];
  emergencyProcedures: string[];
}

export interface RiskAnalysis {
  severity: "HIGH" | "MEDIUM" | "LOW";
  recommendations: string[];
  immediateActions: string[];
  preventiveMeasures: string[];
}

export class AIService {
  private accidentDataCache?: any[];

  // Improved penalty wrapper over hybrid scoring from patch
  private applyHybridScoringWithPenalty(
    list: any[],
    resolvedProfile: Profile,
    equipmentInfoObj: EquipmentInfo,
    workType?: WorkType,
    isEducation = false
  ) {
    const expected = new Set(
      (resolvedProfile.match?.tags_any ?? (equipmentInfoObj.tags ?? [])).map((t: string) => t.toLowerCase())
    );
    return list.map((r) => {
      const base = applyHybridScoring({
        id: r.id,
        title: r.metadata?.title,
        text: r.document,
        content: r.document,
        metadata: r.metadata,
        vectorScore: r.vectorScore ?? r.score ?? r.similarity
      } as SearchItem, resolvedProfile, equipmentInfoObj, workType);

      const tags = (r.metadata?.tags || []).map((x: string) => x.toLowerCase());
      const industry = (r.metadata?.industry || '').toLowerCase();
      const expectEmpty = expected.size === 0;
      const ok = expectEmpty || tags.some((t: string) => expected.has(t)) || expected.has(industry);
      const penalty = ok ? 0 : (isEducation ? 0.15 : 0.30);
      return { ...r, hybridScore: Math.max(0, base - penalty) };
    });
  }

  // Search adapters for vector and keyword queries
  private async runVectorQueries(queries: string[], where?: any): Promise<any[]> {
    const out: any[] = [];
    for (const q of queries) {
      try {
        const res = await chromaDBService.searchRelevantData(q, 15);
        out.push(...(Array.isArray(res) ? res : []));
      } catch (e) {
        console.warn('[vec] query failed', q, e);
      }
    }
    return out;
  }

  private async runKeywordQueries(queries: string[]): Promise<any[]> {
    const out: any[] = [];
    for (const q of queries) {
      try {
        // For now, using the same chromaDB service but in future could use different keyword service
        const res = await chromaDBService.searchRelevantData(q, 15);
        out.push(...(Array.isArray(res) ? res : []));
      } catch (e) {
        console.warn('[kw] query failed', q, e);
      }
    }
    return out;
  }

  // 임계값 계산: 상위 30% + 상한
  private computeThreshold(scores: number[], kind: 'incident' | 'education' | 'regulation') {
    if (!scores.length) return 0;
    const sorted = [...scores].sort((a,b)=>a-b);
    const idx = Math.floor(sorted.length * 0.70);
    const p = sorted[idx];
    const cap = kind === 'education' ? 0.25 : 0.35;
    return Math.min(p, cap);
  }

  // 범용 사고사례 정보 매칭 (프로파일 기반)
  private getKnownAccidentsByProfile(profile: Profile): Record<string, any> {
    // 프로파일별 알려진 사고사례 매핑 (필요시 확장 가능)
    return {
      "비상발전기 정비 중 고압활선 감전": {
        date: "2011.03.09.(수) 08:30경",
        location: "경남 창원시 ○○○○ 공장 내 전기실",  
        accident_type: "감전",
        damage: "사망 1명",
        direct_cause: "고압 활선 상태에서 작업",
        root_cause: "정전 작업 미실시 및 절연용 보호구 미착용"
      },
      "고압변압기 청소작업 중 충전부 접촉 감전": {
        date: "2012.08.15.(수) 14:20경",
        location: "부산시 ○○구 ○○○○ 변전소",
        accident_type: "감전", 
        damage: "사망 1명",
        direct_cause: "충전부 접촉",
        root_cause: "안전교육 미실시 및 작업 절차 미준수"
      },
      "이동식 사다리를 들어올리다 고압선(22.9kV)에 감전": {
        date: "2015.5.29(금) 13:00경",
        location: "전북 진안군, ○○○○ 폭기조 증설공사 현장",
        accident_type: "감전",
        damage: "사망 1명, 부상 1명", 
        direct_cause: "이동식 사다리의 고압선 접촉 감전",
        root_cause: "작업 장소와 인접한 특고압 전선로에 절연용 방호구 미설치 또는 이설 미흡. 위험 요인에 대한 안전 교육 및 관리 감독 미흡."
      },
      "배수펌프 전기판넬 접촉 감전": {
        date: "2018.06.22.(금) 09:45경",
        location: "전남 ○○시 하수처리장",
        accident_type: "감전",
        damage: "부상 1명",
        direct_cause: "전기판넬 충전부 접촉",
        root_cause: "정전 작업 미실시 및 절연장갑 미착용"
      },
      "통신케이블 포설 작업 중 감전": {
        date: "2020.04.10.(금) 15:30경", 
        location: "서울시 ○○구 지하 통신구",
        accident_type: "감전",
        damage: "부상 2명",
        direct_cause: "전력케이블과 통신케이블 혼재로 인한 감전",
        root_cause: "작업 전 위험성 평가 미실시 및 안전거리 확보 실패"
      }
    };
  }

  async analyzeSafetyConditions(
    equipmentInfo: any,
    workType: any,
    specialNotes: string
  ): Promise<SafetyAnalysis> {
    try {
      const prompt = `다음 산업 설비의 안전 상황을 분석하고 한국어로 응답해주세요.

설비 정보:
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 위험 요소: ${this.formatRisks(equipmentInfo)}
- 필요 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "없음"}

작업 정보:
- 작업 유형: ${workType.name}
- 설명: ${workType.description}
- 소요 시간: ${workType.estimatedDuration}분

특이사항: ${specialNotes || "없음"}

다음 형식으로 JSON 응답을 제공해주세요:
{
  "riskLevel": "HIGH|MEDIUM|LOW",
  "recommendations": ["권장사항1", "권장사항2", ...],
  "procedureAdjustments": ["절차조정1", "절차조정2", ...],
  "emergencyProcedures": ["비상절차1", "비상절차2", ...]
}`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 산업 안전 전문가입니다. 설비 안전 분석을 수행하고 실용적인 안전 권장사항을 제공합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              riskLevel: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              recommendations: { type: "array", items: { type: "string" } },
              procedureAdjustments: { type: "array", items: { type: "string" } },
              emergencyProcedures: { type: "array", items: { type: "string" } }
            },
            required: ["riskLevel", "recommendations", "procedureAdjustments", "emergencyProcedures"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
      return {
        riskLevel: result.riskLevel || "MEDIUM",
        recommendations: result.recommendations || [],
        procedureAdjustments: result.procedureAdjustments || [],
        emergencyProcedures: result.emergencyProcedures || []
      };
    } catch (error) {
      console.error("AI 안전 분석 오류:", error);
      return {
        riskLevel: "MEDIUM",
        recommendations: ["AI 분석을 사용할 수 없습니다. 수동으로 안전 점검을 수행하세요."],
        procedureAdjustments: [],
        emergencyProcedures: ["비상시 안전관리자에게 즉시 연락하세요."]
      };
    }
  }

  async analyzeRiskReport(
    equipmentInfo: any,
    riskDescription: string,
    reportedBy: string
  ): Promise<RiskAnalysis> {
    try {
      const prompt = `다음 산업 설비의 위험 보고서를 분석하고 한국어로 응답해주세요.

설비 정보:
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 기존 위험 요소: ${this.formatRisks(equipmentInfo)}

위험 보고:
- 보고자: ${reportedBy}
- 위험 내용: ${riskDescription}

다음 형식으로 JSON 응답을 제공해주세요:
{
  "severity": "HIGH|MEDIUM|LOW",
  "recommendations": ["권장사항1", "권장사항2", ...],
  "immediateActions": ["즉시조치1", "즉시조치2", ...],
  "preventiveMeasures": ["예방조치1", "예방조치2", ...]
}`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 산업 안전 전문가입니다. 위험 보고서를 분석하고 실용적인 대응 방안을 제공합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              recommendations: { type: "array", items: { type: "string" } },
              immediateActions: { type: "array", items: { type: "string" } },
              preventiveMeasures: { type: "array", items: { type: "string" } }
            },
            required: ["severity", "recommendations", "immediateActions", "preventiveMeasures"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
      return {
        severity: result.severity || "MEDIUM",
        recommendations: result.recommendations || [],
        immediateActions: result.immediateActions || [],
        preventiveMeasures: result.preventiveMeasures || []
      };
    } catch (error) {
      console.error("AI 위험 분석 오류:", error);
      return {
        severity: "MEDIUM",
        recommendations: ["AI 분석을 사용할 수 없습니다. 안전관리자와 상담하세요."],
        immediateActions: ["즉시 작업을 중단하고 안전관리자에게 보고하세요."],
        preventiveMeasures: ["정기적인 설비 점검을 실시하세요."]
      };
    }
  }

  async generateVoiceGuide(equipmentInfo: any): Promise<string> {
    try {
      const prompt = `다음 정보로 작업자가 직접 들을 순수한 안전 음성 안내를 한국어로 작성하세요:

설비: ${equipmentInfo.name} (코드: ${equipmentInfo.code})
위치: ${equipmentInfo.location}
위험요소: ${this.formatRisks(equipmentInfo)}
화학물질: ${equipmentInfo.hazardousChemicalType || '해당 없음'}
안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "기본 안전장비"}

작업자가 바로 들을 수 있는 자연스러운 문장만 작성하세요. 마크다운, 번호, 제목, 구분선 등은 절대 사용하지 마세요. 200-250단어로 작성하세요.`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "작업자가 직접 들을 자연스러운 한국어 문장만 생성하세요. 마크다운(#, *, -), 번호(1., 2.), 제목, 구분선은 절대 금지입니다. 샵, 별표, 숫자 등 특수기호나 서식 없이 순수한 문장만 작성하세요. 설명문구('다음은', '안내입니다', '말씀드립니다') 금지. 200-250단어의 자연스러운 문단으로 작성하세요."
        },
        contents: prompt
      });

      return response.text || "안전 수칙을 준수하여 작업하시기 바랍니다.";
    } catch (error) {
      console.error("AI 음성 안내 생성 오류:", error);
      
      // 상세한 안전 중심 폴백 안내
      const riskMessages = [];
      if (equipmentInfo.highTemperature) riskMessages.push("고온 위험");
      if (equipmentInfo.highPressure) riskMessages.push("고압 위험");
      if (equipmentInfo.highVoltage) riskMessages.push("전기 위험");
      if (equipmentInfo.height) riskMessages.push("추락 위험");
      if (equipmentInfo.mechanical) riskMessages.push("기계적 위험");

      return `${equipmentInfo.location}에 위치한 ${equipmentInfo.name}입니다. 설비 코드는 ${equipmentInfo.code}이며, 작업 시 다음 안전수칙을 반드시 준수하시기 바랍니다.

이 설비는 ${riskMessages.length > 0 ? 
  `${riskMessages.join(", ")}이 있어 특별한 주의가 필요합니다. 고온 위험이 있는 경우 내열 장갑과 보호복을 착용하고, 고압 위험이 있는 경우 압력 해제를 완전히 확인한 후 작업하세요. 전기 위험이 있는 경우 전원을 완전히 차단하고 검전기로 무전압 상태를 확인하세요. 추락 위험이 있는 경우 안전대를 착용하고 발판을 견고히 설치하세요. 기계적 위험이 있는 경우 모든 회전부와 가동부의 정지를 확인하세요.` : 
  '일반적인 기계 안전수칙을 적용하지만, 예상치 못한 위험이 발생할 수 있으므로 항상 주의 깊게 작업하세요.'
}

${equipmentInfo.hazardousChemicalType ? 
  `${equipmentInfo.hazardousChemicalType} 유해화학물질이 사용되므로 반드시 전용 보호장비를 착용하고 환기가 잘 되는 곳에서 작업하세요. 화학물질 누출 시 즉시 작업을 중단하고 대피하세요. ` : 
  ''
}

작업 전 필수 점검사항입니다. 반드시 안전모, 안전화, 보안경을 착용하고 작업복을 정리하세요. 안전장비의 손상 여부를 확인하고, 불량 시 즉시 교체하세요. 전원 차단 및 압력 해제를 완전히 확인한 후 작업을 시작하세요. 작업 도구의 상태를 점검하고 주변 정리정돈을 실시하세요.

작업 중에는 설비 주변에 다른 작업자가 있는지 확인하고, 위험 구역 표시를 명확히 설치하세요. 작업 중 이상 징후나 비정상적인 소음, 진동, 온도 상승 등을 발견할 시 즉시 작업을 중단하고 안전한 장소로 대피한 후 관제실에 연락하시기 바랍니다. 응급상황 시에는 비상벨을 누르고 주변 작업자에게 알리세요.`;
    }
  }

  async analyzeStepNote(stepNote: string, stepInfo: any, equipmentInfo: any): Promise<{
    recommendations: string[];
    riskLevel: "HIGH" | "MEDIUM" | "LOW";
    immediateActions: string[];
    preventiveMeasures: string[];
  }> {
    try {
      const equipmentRisks = this.formatRisks(equipmentInfo);
      const equipmentSpecs = this.formatEquipmentSpecifications(equipmentInfo);
      
      const prompt = `산업 안전 전문가로서 작업자가 입력한 특이사항을 종합적으로 분석하여 맞춤형 안전 조치사항을 제공해주세요.

【설비 정보】
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 위험도: ${equipmentInfo.riskLevel}
- 주요 위험 요소: ${equipmentRisks}
- 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "없음"}
- LOTO 포인트: ${equipmentInfo.lockoutTagoutPoints?.join(", ") || "없음"}

【작업 정보】
- 작업: ${stepInfo.title}
- 내용: ${stepInfo.description}
- 유형: ${stepInfo.workType || stepInfo.category || "일반"}

【작업자 특이사항】
"${stepNote}"

위 특이사항을 바탕으로 다음을 분석해주세요:
1. 이 특이사항이 설비와 작업에 미치는 구체적인 위험도
2. 특이사항에 직접 대응하는 맞춤형 안전 조치
3. 현재 상황에서 즉시 취해야 할 구체적 행동
4. 이런 상황이 재발하지 않도록 하는 예방책

JSON 형식으로 응답:
{
  "riskLevel": "HIGH|MEDIUM|LOW",
  "recommendations": ["특이사항에 직접 대응하는 구체적 안전 조치 3-4개"],
  "immediateActions": ["지금 당장 해야 할 구체적 행동 2-3개"],
  "preventiveMeasures": ["재발 방지를 위한 구체적 예방책 2-3개"]
}

중요: 일반적인 조언이 아닌, 입력된 특이사항("${stepNote}")에 직접 관련된 구체적이고 실용적인 조치사항만 제공하세요.`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 산업 안전 전문가입니다. 작업자의 특이사항을 분석하여 적절한 안전 조치사항을 JSON 형식으로 제공합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              riskLevel: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              recommendations: { type: "array", items: { type: "string" } },
              immediateActions: { type: "array", items: { type: "string" } },
              preventiveMeasures: { type: "array", items: { type: "string" } }
            },
            required: ["riskLevel", "recommendations", "immediateActions", "preventiveMeasures"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
      return {
        riskLevel: result.riskLevel || "MEDIUM",
        recommendations: result.recommendations || [],
        immediateActions: result.immediateActions || [],
        preventiveMeasures: result.preventiveMeasures || []
      };
    } catch (error) {
      console.error("작업 특이사항 분석 오류:", error);
      
      // Enhanced contextual fallback analysis
      const noteText = stepNote.toLowerCase();
      const equipmentType = equipmentInfo.name?.toLowerCase() || "";
      
      // Analyze specific issues mentioned in the note
      const hasLeakage = noteText.includes('누수') || noteText.includes('누출') || noteText.includes('새고');
      const hasNoise = noteText.includes('소음') || noteText.includes('잡음') || noteText.includes('시끄러');
      const hasVibration = noteText.includes('진동') || noteText.includes('떨림');
      const hasOverheating = noteText.includes('과열') || noteText.includes('뜨거') || noteText.includes('온도');
      const hasElectricalIssue = noteText.includes('스파크') || noteText.includes('전기') || noteText.includes('합선');
      const hasSmell = noteText.includes('냄새') || noteText.includes('가스') || noteText.includes('연기');
      const hasDamage = noteText.includes('손상') || noteText.includes('파손') || noteText.includes('금') || noteText.includes('균열');
      const hasLoose = noteText.includes('헐거') || noteText.includes('느슨') || noteText.includes('흔들');
      
      // Determine risk level based on specific issues
      let riskLevel: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
      if (hasElectricalIssue || hasSmell || hasDamage || hasLeakage) {
        riskLevel = "HIGH";
      } else if (hasOverheating || hasVibration || hasLoose) {
        riskLevel = "HIGH";
      } else if (hasNoise) {
        riskLevel = "MEDIUM";
      }
      
      // Generate contextual recommendations
      let recommendations: string[] = [];
      let immediateActions: string[] = [];
      let preventiveMeasures: string[] = [];
      
      if (hasLeakage) {
        recommendations.push("누수 지점을 확인하고 주변을 격리하세요");
        recommendations.push("유체 종류에 맞는 개인보호구를 착용하세요");
        immediateActions.push("누수 부위 주변 작업 중단");
        immediateActions.push("누수량과 확산 범위 확인");
        preventiveMeasures.push("정기적인 배관 및 연결부 점검");
        preventiveMeasures.push("개스킷 및 씰 교체 주기 단축");
      }
      
      if (hasNoise) {
        recommendations.push("소음 발생 원인을 파악하고 베어링 상태를 점검하세요");
        recommendations.push("청력 보호구를 반드시 착용하세요");
        immediateActions.push("소음 레벨 측정");
        immediateActions.push("작업자 청력 보호구 확인");
        preventiveMeasures.push("정기적인 소음도 측정 및 기록");
        preventiveMeasures.push("회전부품 윤활 및 정렬 점검 강화");
      }
      
      if (hasVibration) {
        recommendations.push("진동 원인을 찾아 기계 정렬 상태를 점검하세요");
        recommendations.push("볼트 및 고정부 체결 상태를 확인하세요");
        immediateActions.push("진동 수준 측정");
        immediateActions.push("주변 구조물 안전성 확인");
        preventiveMeasures.push("정기적인 진동 분석 실시");
        preventiveMeasures.push("기계 기초 및 고정 상태 점검 강화");
      }
      
      if (hasOverheating) {
        recommendations.push("온도 상승 원인을 파악하고 냉각 시스템을 점검하세요");
        recommendations.push("내열 장갑과 보호복을 착용하세요");
        immediateActions.push("온도 측정 및 기록");
        immediateActions.push("냉각 시스템 작동 상태 확인");
        preventiveMeasures.push("정기적인 열화상 점검");
        preventiveMeasures.push("냉각 시스템 청소 및 정비 주기 단축");
      }
      
      if (hasElectricalIssue) {
        recommendations.push("즉시 전원을 차단하고 전기 안전 절차를 따르세요");
        recommendations.push("절연 보호구를 착용하고 접근하세요");
        immediateActions.push("즉시 전원 차단");
        immediateActions.push("전기 전문가 호출");
        preventiveMeasures.push("전기 시설 정기 절연 저항 측정");
        preventiveMeasures.push("전기 안전 교육 강화");
      }
      
      if (hasSmell) {
        recommendations.push("환기를 강화하고 가스 농도를 측정하세요");
        recommendations.push("호흡 보호구를 착용하고 점화원을 제거하세요");
        immediateActions.push("즉시 환기 실시");
        immediateActions.push("가스 검지기로 농도 측정");
        preventiveMeasures.push("정기적인 가스 누출 점검");
        preventiveMeasures.push("환기 시설 점검 및 개선");
      }
      
      if (hasDamage) {
        recommendations.push("손상 범위를 정확히 파악하고 구조적 안전성을 평가하세요");
        recommendations.push("손상 부위 접근을 제한하고 임시 보강을 검토하세요");
        immediateActions.push("손상 부위 사진 촬영 및 기록");
        immediateActions.push("구조 안전 전문가 상담");
        preventiveMeasures.push("정기적인 비파괴 검사 실시");
        preventiveMeasures.push("재료 피로도 평가 및 교체 계획 수립");
      }
      
      if (hasLoose) {
        recommendations.push("헐거운 부품의 체결 토크를 재확인하세요");
        recommendations.push("연결부 전체의 고정 상태를 점검하세요");
        immediateActions.push("즉시 체결 상태 점검");
        immediateActions.push("토크 렌치로 규정 토크 재체결");
        preventiveMeasures.push("정기적인 체결부 토크 점검");
        preventiveMeasures.push("진동에 의한 풀림 방지 대책 적용");
      }
      
      // Add general recommendations if no specific issue detected
      if (recommendations.length === 0) {
        recommendations.push("특이사항에 대해 상세한 점검을 실시하세요");
        recommendations.push("관련 작업 매뉴얼을 재확인하세요");
        immediateActions.push("현재 상황 상세 기록");
        immediateActions.push("상급자에게 상황 보고");
        preventiveMeasures.push("유사 상황 대응 절차 수립");
        preventiveMeasures.push("작업자 교육 및 훈련 강화");
      }
      
      return {
        riskLevel,
        recommendations: recommendations.slice(0, 4),
        immediateActions: immediateActions.slice(0, 3),
        preventiveMeasures: preventiveMeasures.slice(0, 3)
      };
    }
  }

  async generateEnhancedSafetyBriefing(
    equipmentInfo: any,
    workType: any,
    weatherData: any,
    specialNotes?: string
  ): Promise<any> {
    return await timeit(
      "generateEnhancedSafetyBriefing TOTAL",
      async () => {
        try {
      // Get relevant accident cases using both ChromaDB RAG and simple RAG
      let relevantAccidents: AccidentCase[] = [];
      let workTypeAccidents: AccidentCase[] = [];
      let chromaAccidents: any[] = [];
      let educationMaterials: any[] = [];
      let safetyRegulations: any[] = [];

      try {
        // 프로파일 기반 설비 정보 해석 (태그 자동 추론)
        const equipmentInfoObj: EquipmentInfo = {
          name: equipmentInfo.name,
          tags: equipmentInfo.tags || inferEquipmentTags(equipmentInfo.name),
          riskTags: equipmentInfo.riskTags || inferRiskTags(equipmentInfo.name),
          metadata: {
            type: equipmentInfo.type || 'unknown',
            location: equipmentInfo.location || '',
            workType: workType.name || '',
            specialNotes: specialNotes || '',
            riskLevel: equipmentInfo.riskLevel || 'MEDIUM'
          }
        };
        
        const resolvedProfile = resolveProfile(equipmentInfoObj, workType);
        console.log(`[프로파일] 선택된 프로파일: ${resolvedProfile.id}`);
        console.log(`[프로파일] 장비 태그: ${inferEquipmentTags(equipmentInfoObj).join(', ')}`);
        console.log(`[프로파일] 위험 태그: ${inferRiskTags(equipmentInfoObj).join(', ')}`);
        
        // 프로파일 기반 쿼리 빌더 사용
        const { accidents, regulation, education, all } = buildTargetedSearchQuery(resolvedProfile, equipmentInfoObj, workType);
        
        // 빠른 검증용 로그
        console.log(`[profiles] match id=${resolvedProfile.id} name="${equipmentInfoObj.name}" tags=${JSON.stringify(equipmentInfoObj.tags)} work="${workType?.name}" risks=${JSON.stringify(equipmentInfoObj.riskTags)}`);
        console.log(`[queries]`, { count: all.length, sample: all.slice(0,5) });
        
        // 프로파일의 제외 키워드 + 제조업 잡음 차단용 기본 반키워드
        const negatives = (resolvedProfile.exclude_if_any_keywords ?? [])
          .concat(['사출','성형기','소각','컨베이어','벨트','제조','생산라인','가공']);
        
        // 검색 쿼리에 NOT 키워드 적용 (벡터 검색용)
        const searchQueries = all.map(q =>
          negatives.reduce((s, n) => `${s} -${n}`, q)
        );
        const regulationQueries = regulation;
        const educationQueries = education;
        
        console.log(`[프로파일] 법규 검색 키워드: ${regulationQueries.slice(0,3).join(', ')}...`);
        console.log(`[프로파일] 교육자료 검색 키워드: ${educationQueries.slice(0,3).join(', ')}...`);

        console.log(`RAG 벡터 검색 - 특화 쿼리: ${searchQueries.length}개`);
        
        // NEW PATCHED SEARCH FLOW: Separate vector vs keyword queries
        const queriesForVector = all; // NO negatives for vector search
        const queriesForKeyword = all.map(q => applyNegatives(q, negatives));

        const expectedTags = resolvedProfile.match?.tags_any ?? (equipmentInfoObj.tags ?? []);
        const where = buildRelaxedWhere(expectedTags);

        // Run searches (vector + keyword) and combine
        const vecCandidates = await timeit('vector.search', () => this.runVectorQueries(queriesForVector, where));
        const kwCandidates = await timeit('keyword.search', () => this.runKeywordQueries(queriesForKeyword));

        const candidatesRaw = dbgCount('candidates.raw', dedupById([...(vecCandidates || []), ...(kwCandidates || [])]));
        
        const chromaResults = candidatesRaw;

        // 별도 regulation 검색 추가 (확실히 법규 데이터를 포함시키기 위해)
        console.log('별도 regulation 검색 실행...');
        const regulationSearchResults = await timeit(
          'regulation.direct.search',
          async () => {
            const regResults = await chromaDBService.searchByCategory(regulationQueries[0] || '전기 작업 안전규정', 10);
            return regResults.regulation || [];
          }
        );
        console.log(`별도 regulation 검색 결과: ${regulationSearchResults.length}건`);
        regulationSearchResults.forEach((reg, idx) => {
          console.log(`  별도검색 법규 ${idx+1}: "${reg.metadata?.title}" (거리: ${reg.distance})`);
        });
        
        // 중복 제거 (기본 검색 결과 + 별도 regulation 검색 결과)
        const uniqueResults = new Map();
        chromaResults.forEach((r: any) => {
          const key = r.metadata?.id || r.document;
          if (!uniqueResults.has(key)) {
            uniqueResults.set(key, r);
          }
        });
        
        // 별도 regulation 검색 결과 추가
        regulationSearchResults.forEach((r: any) => {
          const key = r.metadata?.id || r.document;
          if (!uniqueResults.has(key)) {
            uniqueResults.set(key, r);
          }
        });
        
        let filteredChromaResults = Array.from(uniqueResults.values());
        
        // 법령 검색 (설비별 특화)
        console.log(`법령 특화 검색: ${regulationQueries.length}개 쿼리`);
        const existingIds = new Set(filteredChromaResults.map(r => r.metadata?.id || r.document));
        
        for (const query of regulationQueries) {
          const additionalResults = await timeit(
            `regulation.search "${query.substring(0, 20)}..."`, 
            () => chromaDBService.searchRelevantData(query, 6)
          );
          // 170kV GIS 특화 법령 필터링 (매우 구체적)


          
          const relevantRegulations = additionalResults.filter(r => {
            const content = (r.document || '').toLowerCase();
            const title = (r.metadata?.title || '').toLowerCase();
            const type = r.metadata?.type;
            
            // 타입이 regulation인지 먼저 확인
            if (type !== 'regulation') {
              return false;
            }

            // 강화된 산업별 관련성 확인
            const searchItem: SearchItem = {
              id: r.metadata?.id || r.document || 'unknown',
              content,
              title,
              metadata: r.metadata
            };
            
            // 1차: 프로파일 기반 관련성 확인
            const isRelevant = shouldIncludeContent(searchItem, resolvedProfile);
            
            // 2차: 설비 특화 키워드 매칭 (전기설비용)
            let equipmentRelevant = false;
            if (resolvedProfile.id === 'electrical-hv-gis') {
              const electricalKeywords = ['전기', '절연', '고압', '특별고압', '변전', 'gis', '개폐기', '충전부', '활선'];
              equipmentRelevant = electricalKeywords.some(keyword => 
                title.includes(keyword) || content.includes(keyword)
              );
            } else {
              equipmentRelevant = true; // 다른 프로파일은 기본 통과
            }
            
            const notDuplicate = !existingIds.has(r.metadata?.id || r.document);
            
            return isRelevant && equipmentRelevant && notDuplicate;
          });

          filteredChromaResults = [...filteredChromaResults, ...relevantRegulations];
          
          relevantRegulations.forEach(r => existingIds.add(r.metadata?.id || r.document));
        }
        
        // 교육자료 검색 (설비별 특화, 더 많은 결과)
        for (const query of educationQueries) {
          const eduResults = await timeit(
            `education.search "${query.substring(0, 20)}..."`, 
            () => chromaDBService.searchRelevantData(query, 8)
          ); // 검색량 증가
          const relevantEducation = eduResults.filter(r => {
            const content = (r.document || '').toLowerCase();
            const title = (r.metadata?.title || '').toLowerCase();
            const industry = (r.metadata?.industry || '').toLowerCase();
            
            // 프로파일 기반 관련성 확인
            const searchItem: SearchItem = {
              id: r.metadata?.id || r.document || 'unknown',
              content,
              title,
              metadata: r.metadata
            };
            
            // 1차: 프로파일 기반 관련성 확인
            const isRelevant = shouldIncludeContent(searchItem, resolvedProfile);
            
            // 2차: 산업별 관련성 추가 확인 (전기설비용)
            let industryRelevant = true;
            if (resolvedProfile.id === 'electrical-hv-gis') {
              // 전기 관련 산업만 허용, 제조업 제외
              const electricalIndustries = ['전기', '전력', '에너지', '발전', '송전', '배전', '변전'];
              const manufacturingKeywords = ['제조', '생산', '가공', '포장', '운반'];
              
              const hasElectricalContent = electricalIndustries.some(keyword => 
                title.includes(keyword) || content.includes(keyword) || industry.includes(keyword)
              );
              
              const hasManufacturingContent = manufacturingKeywords.some(keyword => 
                title.includes(keyword) || content.includes(keyword) || industry.includes(keyword)
              );
              
              industryRelevant = hasElectricalContent || !hasManufacturingContent;
            }
            
            const isNotDuplicate = !existingIds.has(r.metadata?.id || r.document);
            
            return isRelevant && industryRelevant && isNotDuplicate;
          });
          filteredChromaResults = [...filteredChromaResults, ...relevantEducation];
          
          relevantEducation.forEach(r => existingIds.add(r.metadata?.id || r.document));
        }

        // 하이브리드 검색: 프로파일 기반 벡터 유사도 + 키워드 점수 조합
        let keywordWeights: { [key: string]: number } = {};
        try {
          keywordWeights = this.getProfileKeywords(resolvedProfile);
        } catch (error) {
          console.log(`[프로파일] 키워드 가중치 생성 실패, 기본값 사용:`, error);
          // 기본 키워드 가중치
          keywordWeights = {
            "안전": 5,
            "점검": 4,
            "정비": 4,
            "위험": 6,
            "사고": 6
          };
        }
        
        // RELAXED: Prefilter by type only (remove profile filtering to let adaptive system handle it)
        const preIncidents = dbgCount('incidents.prefilter', (candidatesRaw || []).filter(r => {
          return normType(r.metadata) === 'incident';
        }));

        const preEducation = dbgCount('education.prefilter', (candidatesRaw || []).filter(r => {
          return normType(r.metadata) === 'education';
        }));

        const preRegulations = dbgCount('regulations.prefilter', (candidatesRaw || []).filter(r => {
          return normType(r.metadata) === 'regulation';
        }));

        // Remove old scoring logic - now handled by adaptive system

        // ===== ADAPTIVE BACKOFF SYSTEM APPLIED =====
        // Use adaptive processing with enhanced fallback for better content recall
        const finalIncidents   = processCategoryAdaptive(preIncidents,   'incident',  resolvedProfile, equipmentInfoObj, workType, /*min*/1, /*max*/6);
        const finalEducation   = processCategoryAdaptive(preEducation,   'education', resolvedProfile, equipmentInfoObj, workType, /*min*/1, /*max*/5);  
        const finalRegulations = processCategoryAdaptive(preRegulations, 'regulation',resolvedProfile, equipmentInfoObj, workType, /*min*/1, /*max*/6);

        // Use adaptive results (already processed with backoff logic)
        const adaptiveIncidents   = dbgCount('incidents.adaptive', finalIncidents);
        const adaptiveEducation   = dbgCount('education.adaptive', finalEducation);
        const adaptiveRegulations = dbgCount('regulations.adaptive', finalRegulations);

        // Safety: guarantee some output if everything is empty (using adaptive results)
        const incidentsOut   = ensureNonEmpty('incidents', adaptiveIncidents, () => finalIncidents.slice(0, Math.min(3, finalIncidents.length)));
        const educationOut   = ensureNonEmpty('education', adaptiveEducation, () => finalEducation.slice(0, Math.min(2, finalEducation.length)));
        const regulationsOut = ensureNonEmpty('regulations', adaptiveRegulations, () => finalRegulations.slice(0, Math.min(3, finalRegulations.length)));

        const hybridFilteredAccidents = incidentsOut;
        const hybridFilteredEducation = educationOut;
        
        let regulations = regulationsOut;

        // 전기설비 특화: safety_rules.json에서 직접 로드 (항상 실행)
        
        try {
          const safetyRulesPath = path.join(process.cwd(), 'embed_data', 'safety_rules.json');
          const safetyRulesData = JSON.parse(fs.readFileSync(safetyRulesPath, 'utf-8'));
          
          // 전기설비 관련 핵심 조문들 (170kV GIS 고압설비 작업 특화)
          const electricalKeywords = [
            '전기', '감전', '충전부', '절연', '접지', '정전', '활선',
            '특별고압', '고압', '변전', '개폐기', '절연보호구', 
            'GIS', '가스절연', 'SF6', '배전반', '차단기',
            '전로', '전기기계', '전기기구', '누전차단기', '단로기'
          ];
          
          // 키워드 기반으로 관련 법령 검색
          const relevantArticles = safetyRulesData.articles.filter((article: any) => {
            const title = article.article_korean_title?.toLowerCase() || '';
            const body = article.body?.toLowerCase() || '';
            const content = title + ' ' + body;
            
            // 전기설비 관련 키워드 매칭 점수 계산
            const matchedKeywords = electricalKeywords.filter(keyword => 
              content.includes(keyword)
            );
            const keywordMatches = matchedKeywords.length;
            
            // 최소 1개 이상의 키워드가 매칭되어야 선택 (조건 완화)
            return keywordMatches >= 1;
          })
          .sort((a: any, b: any) => {
            // 키워드 매칭 수로 정렬 (많은 것부터)
            const aMatches = electricalKeywords.filter(keyword => 
              (a.article_korean_title?.toLowerCase() + ' ' + a.body?.toLowerCase()).includes(keyword)
            ).length;
            const bMatches = electricalKeywords.filter(keyword => 
              (b.article_korean_title?.toLowerCase() + ' ' + b.body?.toLowerCase()).includes(keyword)
            ).length;
            return bMatches - aMatches;
          });
          
          const selectedArticles = relevantArticles
            .slice(0, 5);
          
          const directRegulations = selectedArticles.map((article: any) => ({
            lawName: '산업안전보건기준에 관한 규칙',
            articleNumber: `제${article.article_number}조`,
            articleTitle: article.article_korean_title,
            fullContent: article.body,
            distance: 0.1
          }));
          
          regulations = [...regulations, ...directRegulations];
          
        } catch (error) {
          console.error('전기설비 법령 직접 로드 실패:', error);
        }

        // 전기설비 특화: 조건부 추가 로드
        if (resolvedProfile.id === 'electrical-hv-gis') {
          
          try {
            const safetyRulesPath = path.join(process.cwd(), 'embed_data', 'safety_rules.json');
            const safetyRulesData = JSON.parse(fs.readFileSync(safetyRulesPath, 'utf-8'));
            
            // 전기설비 관련 핵심 조문들
            const electricalArticles = [319, 320, 321, 323, 162, 163, 164, 306, 315, 316];
            
            const selectedArticles = safetyRulesData.articles
              .filter((article: any) => electricalArticles.includes(article.article_number))
              .slice(0, 5);
            
            const directRegulations = selectedArticles.map((article: any) => ({
              lawName: '산업안전보건기준에 관한 규칙',
              articleNumber: `제${article.article_number}조`,
              articleTitle: article.article_korean_title,
              fullContent: article.body,
              distance: 0.1
            }));
            
            regulations = [...regulations, ...directRegulations];
            
          } catch (error) {
            console.error('전기설비 법령 직접 로드 실패:', error);
          }
        }
        
        // 프로파일 기반 강제 검색 실행 (regulation 타입 부족 문제 해결)
        try {
            // 프로파일에서 법규 검색 쿼리 사용
            const profileRegulationQueries = regulationQueries.slice(0, 5);
            
            let profileRegulations: any[] = [];
            for (const query of profileRegulationQueries) {
              const searchResult = await chromaDBService.searchByCategory(query, 3);
              if (searchResult.regulation && searchResult.regulation.length > 0) {
                profileRegulations = [...profileRegulations, ...searchResult.regulation];
              }
            }
            
            // 중복 제거 및 프로파일 기반 관련성 필터링
            const uniqueProfileRegs = new Map();
            profileRegulations.forEach(reg => {
              const content = (reg.document || '').toLowerCase();
              const title = (reg.metadata?.title || '').toLowerCase();
              
              // 프로파일 기반 관련성 확인
              const searchItem: SearchItem = {
                id: reg.metadata?.id || reg.document || 'unknown',
                content,
                title,
                metadata: reg.metadata
              };
              
              const isRelevant = shouldIncludeContent(searchItem, resolvedProfile);
              
              if (isRelevant) {
                const key = reg.metadata?.id || reg.document;
                if (!uniqueProfileRegs.has(key)) {
                  uniqueProfileRegs.set(key, reg);
                }
              }
            });
            
            const additionalRegulations = Array.from(uniqueProfileRegs.values()).slice(0, 5);
            regulations = [...regulations, ...additionalRegulations].slice(0, 5);
            
        } catch (error) {
          console.error('프로파일 기반 강제 법규 검색 실패:', error);
        }
        
        // 하이브리드 점수 디버깅 로그
        console.log(`하이브리드 검색 결과: incidents=${hybridFilteredAccidents.length}, education=${hybridFilteredEducation.length}, regulation=${regulations.length}`);
        console.log('상위 사고사례 하이브리드 점수:');
        hybridFilteredAccidents.slice(0, 3).forEach((acc, idx) => {
          console.log(`  ${idx+1}. "${acc.metadata?.title}" - 종합점수: ${acc.hybridScore?.toFixed(3)}, 벡터: ${acc.vectorScore?.toFixed(3)}, 키워드: ${acc.keywordScore}, 핵심키워드: ${acc.criticalKeywordFound}`);
        });
        
        // 교육자료 필터링 전후 비교
        const rawEducationResults = filteredChromaResults.filter(r => r.metadata.type === 'education');
        console.log(`교육자료 필터링 전: ${rawEducationResults.length}건`);
        console.log('교육자료 하이브리드 점수:');
        rawEducationResults.slice(0, 3).forEach((edu, idx) => {
          const scored = this.applyLegacyHybridScoring([edu], keywordWeights, resolvedProfile)[0];
          if (scored) {
            console.log(`  ${idx+1}. "${edu.metadata?.title}" - 종합점수: ${scored.hybridScore?.toFixed(3)}, 벡터: ${scored.vectorScore?.toFixed(3)}, 키워드: ${scored.keywordScore}, 핵심키워드: ${scored.criticalKeywordFound}`);
          }
        });
        
        // 사고사례: 벡터 유사도 상위 5건 (알려진 사고사례 정보와 매칭)
        const knownAccidents = this.getKnownAccidentsByProfile(resolvedProfile);
        
        chromaAccidents = hybridFilteredAccidents
          .map((r) => {
              const metadata = r.metadata;
              const title = metadata.title || '';
              
              // 알려진 전기 사고사례에서 완전한 정보 찾기 (정확 매칭 및 정규화 매칭)
              const normalizedTitle = title.replace(/[!?.,\s]+$/, '').trim(); // 끝의 특수문자와 공백 제거
              let knownData = knownAccidents[title] || knownAccidents[normalizedTitle];
              
              // 부분 매칭도 시도
              if (!knownData) {
                for (const [knownTitle, data] of Object.entries(knownAccidents)) {
                  if (title.includes(knownTitle) || knownTitle.includes(title.replace(/[!?.,\s]+$/, ''))) {
                    knownData = data;
                    break;
                  }
                }
              }
              
              if (knownData) {
                return {
                  title: title,
                  date: knownData.date,
                  location: knownData.location,
                  accident_type: knownData.accident_type,
                  damage: knownData.damage,
                  summary: r.document.split('\n')[1] || `${knownData.accident_type} 사고로 ${knownData.damage} 발생`,
                  direct_cause: knownData.direct_cause,
                  root_cause: knownData.root_cause,
                  prevention: r.document.split('예방대책: ')[1] || "안전교육 실시, 보호구 착용, 정전작업 원칙 준수",
                  work_type: metadata.work_type || (workType?.name ?? '일반작업'),
                  industry: metadata.industry || ((resolvedProfile.match?.tags_any ?? [])[0] ?? '미상'),
                  risk_keywords: metadata.risk_keywords || (inferRiskTags(equipmentInfoObj).join(', ') || '미상'),
                  relevanceScore: (1 - r.distance).toFixed(3)
                };
              } else {
                const document = r.document;
                const lines = document.split('\n');
                const extractField = (pattern: string, fallback = '') => {
                  const line = lines.find((l: string) => l.includes(pattern));
                  return line ? line.split(':')[1]?.trim() || fallback : fallback;
                };
                
                return {
                  title: title,
                  date: extractField('날짜') || metadata.date || '날짜 미상',
                  location: extractField('장소') || '장소 미상',
                  accident_type: extractField('사고형태') || '감전',
                  damage: extractField('피해규모') || '피해 미상',
                  summary: extractField('개요') || lines[1] || '사고 상세 정보 없음',
                  direct_cause: extractField('직접원인') || '직접원인 미상',
                  root_cause: extractField('근본원인') || '근본원인 미상', 
                  prevention: extractField('예방대책') || document.split('예방대책: ')[1] || '예방대책 미상',
                  work_type: metadata.work_type || extractField('작업종류') || (workType?.name ?? '일반작업'),
                  industry: metadata.industry || extractField('업종') || ((resolvedProfile.match?.tags_any ?? [])[0] ?? '미상'),
                  risk_keywords: metadata.risk_keywords || extractField('위험요소') || (inferRiskTags(equipmentInfoObj).join(', ') || '미상'),
                  relevanceScore: (1 - r.distance).toFixed(3)
                };
              }
            });
        
        // 교육자료: 하이브리드 점수 상위 6건 + URL 매칭
        const educationDataWithUrls = await timeit(
          `matchEducationWithUrls x${hybridFilteredEducation.length}`,
          () => this.matchEducationWithUrls(hybridFilteredEducation)
        );
        
        // 외국어 교육자료 제거 (URL 매칭 후 최종 필터링)
        const filteredEducationData = educationDataWithUrls.filter(r => {
          const title = (r.metadata?.title || '').toLowerCase();
          const foreignLanguagePatterns = [
            '스리랑카', '태국', '방글라데시', '베트남', '캄보디아', '네팔', 
            'english', 'working safely', 'appliances'
          ];
          
          const isForeignLanguage = foreignLanguagePatterns.some(pattern => 
            title.includes(pattern)
          );
          
          if (isForeignLanguage) {
            return false;
          }
          
          return true;
        });
        
        educationMaterials = filteredEducationData.map(r => ({
          title: r.metadata.title,
          content: r.document.split('\n')[1] || '',
          category: r.metadata.category,
          url: r.url || '',
          type: r.type || 'unknown',
          date: r.date || '',
          keywords: r.keywords || ''
        }));
        
        console.log(`교육자료 최종 필터링: ${educationDataWithUrls.length}건 → ${filteredEducationData.length}건`);
        
        // 법령: 이미 처리된 regulations 배열을 사용
        console.log(`처리할 총 법령 수: ${regulations.length}건`);
        
        let processedRegulations = new Map();
        regulations.forEach((reg, index) => {
          let articleNumber = '';
          let articleTitle = '';
          let fullContent = '';
          
          if (reg.articleNumber && reg.articleTitle) {
            // 직접 로드된 전기설비 법령 사용
            articleNumber = reg.articleNumber;
            articleTitle = reg.articleTitle;
            fullContent = reg.fullContent || '';
            console.log(`직접로드 법령 ${index + 1}: ${articleNumber}(${articleTitle})`);
          } else {
            // 벡터 검색 법령은 기존 로직으로 처리
            const content = reg.document || '';
            const articleMatch = content.match(/제(\d+)조\s*\(([^)]+)\)/);
            if (articleMatch) {
              articleNumber = `제${articleMatch[1]}조`;
              articleTitle = articleMatch[2];
              fullContent = content;

            }
          }
          
          if (articleNumber) {
            processedRegulations.set(articleNumber, {
              lawName: '산업안전보건기준에 관한 규칙',
              articleNumber: articleNumber,
              articleTitle: articleTitle,
              fullContent: fullContent,
              distance: reg.distance || 0.1
            });
          }
        });
        
        // 관련성 순으로 정렬하여 상위 10개 선택
        const sortedRegulations = Array.from(processedRegulations.values())
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);

        // AI를 사용하여 각 조문 요약
        safetyRegulations = await timeit(
          `summarizeRegulationCached x${sortedRegulations.length}`,
          () => Promise.all(
            sortedRegulations.map(async (reg) => {
              const summary = await this.summarizeRegulation(reg.fullContent, reg.articleTitle);
              return {
                ...reg,
                summary: summary
              };
            })
          )
        );

        console.log(`RAG 검색 완료: 사고사례 ${chromaAccidents.length}건, 교육자료 ${educationMaterials.length}건, 법규 ${safetyRegulations.length}건`);
      } catch (error) {
        console.log('ChromaDB 검색 실패, 기본 RAG 사용:', error);
        // 기본값으로 초기화
        chromaAccidents = [];
        educationMaterials = [];
        safetyRegulations = [];
      }

      // Fallback to simple RAG if ChromaDB fails
      if (chromaAccidents.length === 0) {
        relevantAccidents = await ragService.searchRelevantAccidents(
          workType.name,
          equipmentInfo.name,
          this.extractRiskFactors(equipmentInfo),
          3
        );
        workTypeAccidents = await ragService.getAccidentsByWorkType(workType.name, 2);
      }

      // Format accident context for AI prompt
      const accidentContext = chromaAccidents.length > 0 
        ? this.formatChromaAccidentCases(chromaAccidents)
        : this.formatAccidentCases([...relevantAccidents, ...workTypeAccidents]);

      const prompt = `다음 정보를 종합하여 포괄적인 AI 안전 브리핑을 생성해주세요:

【설비 정보】
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 위험도: ${equipmentInfo.riskLevel}
- 주요 위험 요소: ${this.formatRisks(equipmentInfo)}
- 필요 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "기본 안전장비"}

【작업 정보】
- 작업 유형: ${workType.name}
- 작업 설명: ${workType.description}
- 예상 소요 시간: ${workType.estimatedDuration}분
- 등록된 필수 안전장비: ${workType.requiredEquipment?.join(", ") || "없음"}
- 등록된 필수 작업도구: ${workType.requiredTools?.join(", ") || "없음"}

【날씨 정보】
- 현재 날씨: ${weatherData.condition}
- 온도: ${weatherData.temperature}°C
- 습도: ${weatherData.humidity}%
- 풍속: ${weatherData.windSpeed}m/s
- 안전 주의사항: ${weatherData.safetyWarnings?.join(", ") || "없음"}

【관련 사고사례】
${accidentContext}

${educationMaterials.length > 0 ? `【관련 교육자료】
${this.formatEducationMaterials(educationMaterials)}` : ''}

${safetyRegulations.length > 0 ? `【관련 안전규칙】
${this.formatSafetyRegulations(safetyRegulations)}` : ''}

【특이사항】
${specialNotes || "없음"}

등록된 필수 안전장비와 작업도구를 우선적으로 포함하되, 추가로 필요하다고 판단되는 항목들을 AI 추천으로 포함해주세요.

다음 형식으로 JSON 응답을 제공해주세요:
{
  "workSummary": "작업 개요 설명",
  "riskFactors": ["위험요인1", "위험요인2", ...],
  "riskAssessment": {
    "totalScore": 숫자,
    "riskFactors": [
      {"factor": "위험요인명", "probability": 숫자, "severity": 숫자, "score": 숫자}
    ]
  },
  "requiredTools": [
    {"name": "도구명", "source": "registered|ai_recommended"}
  ],
  "requiredSafetyEquipment": [
    {"name": "장비명", "source": "registered|ai_recommended"}
  ],
  "weatherConsiderations": ["날씨고려사항1", "날씨고려사항2", ...],
  "safetyRecommendations": ["안전권고1", "안전권고2", ...],
  "regulations": [
    {"title": "관련규정명", "category": "분류"}
  ],
  "relatedIncidents": [
    {"title": "사고사례제목", "severity": "심각도"}
  ],
  "educationMaterials": [
    {"title": "교육자료명", "type": "유형"}
  ],
  "quizQuestions": [
    {
      "question": "퀴즈문제",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctAnswer": 정답번호(0-3),
      "explanation": "해설"
    }
  ],
  "safetySlogan": "오늘의 안전 슬로건"
}`;

      const response = await timeit(
        "gemini.generateContent(briefing)",
        () => genai.models.generateContent({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: "당신은 RAG 기반 산업 안전 전문가입니다. 제공된 실제 사고사례를 참고하여 실용적이고 구체적인 안전 브리핑을 생성합니다. 관련 사고사례의 교훈을 안전 권고사항에 반영하세요.",
            responseMimeType: "application/json"
          },
          contents: prompt
        })
      );

      const result = JSON.parse(response.text || "{}");
      
      // Process and merge registered checklist items with AI recommendations
      const processedTools = this.mergeRegisteredAndAIItems(
        workType.requiredTools || [],
        result.requiredTools || []
      );
      
      const processedSafetyEquipment = this.mergeRegisteredAndAIItems(
        workType.requiredEquipment || [],
        result.requiredSafetyEquipment || []
      );
      
      // Update result with processed items
      result.requiredTools = processedTools;
      result.requiredSafetyEquipment = processedSafetyEquipment;
      
      // Force override with actual RAG search results regardless of AI response
      result.regulations = safetyRegulations.length > 0 ? safetyRegulations.map(reg => ({
        lawName: reg.lawName,
        articleNumber: reg.articleNumber,
        articleTitle: reg.articleTitle,
        summary: reg.summary,
        relevanceScore: reg.distance
      })) : [];
      
      result.relatedIncidents = chromaAccidents.length > 0 ? chromaAccidents.map(acc => ({
        title: acc.title,
        severity: this.mapAccidentTypeToSeverity(acc.accident_type),
        workType: acc.work_type,
        accidentType: acc.accident_type,
        summary: acc.summary,
        prevention: acc.prevention,
        date: acc.date,
        location: acc.location,
        damage: acc.damage
      })) : [];
      
      result.educationMaterials = educationMaterials.length > 0 ? educationMaterials.map(edu => ({
        title: edu.title,
        type: edu.type,
        keywords: edu.keywords,
        content: edu.content,
        url: edu.url,
        date: edu.date
      })) : [];

      // Add debug info
      console.log('RAG 검색 결과 적용:', {
        regulations: result.regulations.length,
        incidents: result.relatedIncidents.length, 
        education: result.educationMaterials.length
      });

      return result;

        } catch (error) {
          console.error("Enhanced safety briefing generation error:", error);
          
          // Fallback to basic briefing without RAG, but include registered checklist items
          const fallbackTools = this.mergeRegisteredAndAIItems(
            workType.requiredTools || [],
            ["기본 작업도구"]
          );
          
          const fallbackSafetyEquipment = this.mergeRegisteredAndAIItems(
            workType.requiredEquipment || [],
            ["안전모", "안전화", "보안경"]
          );
          
          return {
            workSummary: `${equipmentInfo.name}에서 ${workType.name} 작업을 수행합니다.`,
            riskFactors: ["기본 안전수칙 준수"],
            riskAssessment: { totalScore: 5, riskFactors: [] },
            requiredTools: fallbackTools,
            requiredSafetyEquipment: fallbackSafetyEquipment,
            weatherConsiderations: ["현재 날씨 조건 확인"],
            safetyRecommendations: ["안전수칙을 준수하며 작업하세요"],
            regulations: [],
            relatedIncidents: [],
            educationMaterials: [],
            quizQuestions: [],
            safetySlogan: "안전이 최우선입니다",
            relatedAccidentCases: []
          };
        }
      }
    );
  }

  // 프로파일 기반 핵심 키워드 가중치 정의
  private getProfileKeywords(profile: Profile): { [key: string]: number } {
    const keywordWeights: { [key: string]: number } = {};
    
    // 프로파일의 기본 키워드로 가중치 적용
    if (profile.keywords) {
      profile.keywords.forEach((keyword, index) => {
        // 첫 번째 키워드들에 더 높은 가중치
        keywordWeights[keyword] = index < 3 ? 8 : 5;
      });
    }
    
    // 쿼리 키워드들에도 가중치 적용
    if (profile.queries?.regulation) {
      profile.queries.regulation.forEach(keyword => {
        keywordWeights[keyword] = 6;
      });
    }
    
    if (profile.queries?.education) {
      profile.queries.education.forEach(keyword => {
        keywordWeights[keyword] = 4;
      });
    }
    
    console.log(`[프로파일] ${profile.id} 키워드 가중치 생성: ${Object.keys(keywordWeights).length}개`);
    return keywordWeights;
  }

  // 프로파일 기반 하이브리드 점수 계산 (벡터 유사도 + 키워드 매칭) - Legacy method
  private applyLegacyHybridScoring(results: any[], keywordWeights: { [key: string]: number }, profile?: Profile): any[] {
    const scoredResults = results.map(result => {
      const title = result.metadata?.title || '';
      const content = result.document || '';
      const searchText = `${title} ${content}`.toLowerCase();
      const isEducation = result.metadata?.type === 'education';
      
      // 벡터 유사도 점수 (0-1, 높을수록 좋음)
      const vectorScore = Math.max(0, 1 - result.distance);
      
      // 키워드 매칭 점수
      let keywordScore = 0;
      let criticalKeywordFound = false;
      let educationKeywordFound = false;
      
      console.log(`[scoring] "${title}" - 타입: ${isEducation ? 'education' : 'incident'}, 벡터점수: ${vectorScore.toFixed(3)}, 거리: ${result.distance}`);
      
      Object.entries(keywordWeights).forEach(([keyword, weight]) => {
        if (searchText.includes(keyword.toLowerCase())) {
          keywordScore += weight;
          if (weight >= 8) { // 핵심 키워드 (170kV, GIS, 가스절연개폐장치, 특별고압)
            criticalKeywordFound = true;
          }
          if (['교육', '안전교육', '보호구', '절연장갑', '안전수칙', '작업지침'].includes(keyword)) {
            educationKeywordFound = true;
          }
        }
      });
      
      // 교육자료별 점수 조정
      if (isEducation) {
        // 프로파일 기반 관련성 검사
        const searchItem: SearchItem = {
          id: result.metadata?.id || result.document || 'unknown',
          content: searchText,
          title: title,
          metadata: result.metadata
        };
        
        const isRelevant = profile ? shouldIncludeContent(searchItem, profile) : true;
        const hasIrrelevantKeyword = !isRelevant;
        
        // 불필요한 키워드가 있으면 점수 대폭 감소
        if (hasIrrelevantKeyword) {
          keywordScore = keywordScore * 0.05;
        }
        
        // 교육자료는 벡터 점수에 더 많은 가중치
        let hybridScore = (vectorScore * 0.6) + (keywordScore * 0.4);
        
        // 산업/설비 불일치 패널티
        const tags = (result.metadata?.tags || []).map((x: string) => x.toLowerCase());
        const industry = (result.metadata?.industry || '').toLowerCase();
        const expect = new Set(['electrical','substation','gis']);
        const industryOk = tags.some((t: string) => expect.has(t)) || expect.has(industry);
        if (!industryOk) {
          // 교육은 완전 제외보단 패널티
          const penalty = 0.15;
          hybridScore = Math.max(0, hybridScore - penalty);
        }
        
        // 불필요한 키워드가 있으면 전체 점수도 감소
        if (hasIrrelevantKeyword) {
          hybridScore = hybridScore * 0.1;
        }
        
        // 교육자료에 대해서는 더 관대한 핵심 키워드 판정 (불필요한 키워드가 없을 때만)
        if (!hasIrrelevantKeyword) {
          if (!criticalKeywordFound && !educationKeywordFound && keywordScore > 0) {
            keywordScore = keywordScore * 0.5; // 덜 엄격한 감점
          } else if (!criticalKeywordFound && !educationKeywordFound) {
            keywordScore = keywordScore * 0.2;
          }
        }
        
        console.log(`[education] "${title}" 최종점수: ${hybridScore.toFixed(3)} (벡터: ${vectorScore.toFixed(3)}, 키워드: ${keywordScore}, 불필요키워드: ${hasIrrelevantKeyword})`);
        
        return {
          ...result,
          hybridScore,
          vectorScore,
          keywordScore,
          criticalKeywordFound: criticalKeywordFound || educationKeywordFound
        };
      } else {
        // 사고사례는 기존 로직 유지
        if (!criticalKeywordFound && Object.keys(keywordWeights).length > 0) {
          keywordScore = keywordScore * 0.1;
        }
        
        let hybridScore = (vectorScore * 0.3) + (keywordScore * 0.7);
        
        // 산업/설비 불일치 패널티 (사고/법규는 더 강하게)
        const tags = (result.metadata?.tags || []).map((x: string) => x.toLowerCase());
        const industry = (result.metadata?.industry || '').toLowerCase();
        const expect = new Set(['electrical','substation','gis']);
        const industryOk = tags.some((t: string) => expect.has(t)) || expect.has(industry);
        if (!industryOk) {
          const penalty = 0.3;
          hybridScore = Math.max(0, hybridScore - penalty);
        }
        
        return {
          ...result,
          hybridScore,
          vectorScore,
          keywordScore,
          criticalKeywordFound
        };
      }
    });
    
    // 하이브리드 점수 순으로 정렬
    const sorted = scoredResults.sort((a, b) => b.hybridScore - a.hybridScore);
    
    // 교육자료는 조정된 임계값 적용 (더 관대하게 설정)
    const isEducationType = results.some(r => r.metadata?.type === 'education');
    const threshold = isEducationType ? 0.05 : 0.05; // 0.25, 0.5에서 0.05로 완화
    
    const filtered = sorted.filter(r => r.hybridScore > threshold);
    return filtered;
  }

  // 교육자료 URL 매칭 메서드
  private async matchEducationWithUrls(educationResults: any[]): Promise<any[]> {
    try {
      // education_data.json 파일 로드
      const educationDataPath = path.join(process.cwd(), 'attached_assets', 'education_data.json');
      if (!fs.existsSync(educationDataPath)) {
        console.warn('교육자료 URL 매칭용 파일을 찾을 수 없습니다:', educationDataPath);
        return educationResults;
      }
      
      const educationData = JSON.parse(fs.readFileSync(educationDataPath, 'utf-8'));
      console.log(`교육자료 URL 매칭용 데이터 ${educationData.length}건 로드`);
      
      return educationResults.map(result => {
        const title = result.metadata.title;
        
        // 제목으로 완전 매칭 시도
        let matchedEducation = educationData.find((edu: any) => 
          edu.title === title
        );
        
        // 완전 매칭이 안 되면 부분 매칭 시도
        if (!matchedEducation) {
          matchedEducation = educationData.find((edu: any) => {
            const eduTitle = edu.title.toLowerCase().trim();
            const searchTitle = title.toLowerCase().trim();
            
            // 키워드 기반 매칭
            const titleWords = searchTitle.split(/\s+/);
            return titleWords.some((word: string) => word.length > 1 && eduTitle.includes(word));
          });
        }
        
        if (matchedEducation) {

          return {
            ...result,
            url: matchedEducation.url,
            file_url: matchedEducation.file_url,
            type: matchedEducation.type,
            date: matchedEducation.date,
            keywords: matchedEducation.keywords
          };
        } else {

          return {
            ...result,
            url: '',
            file_url: '',
            type: 'unknown',
            date: '',
            keywords: ''
          };
        }
      });
      
    } catch (error) {
      console.error('교육자료 URL 매칭 중 오류:', error);
      return educationResults;
    }
  }

  private extractRiskFactors(equipmentInfo: any): string[] {
    const factors = [];
    if (equipmentInfo.highTemperature) factors.push("고온");
    if (equipmentInfo.highPressure) factors.push("고압");
    if (equipmentInfo.highVoltage) factors.push("전기");
    if (equipmentInfo.height) factors.push("추락");
    if (equipmentInfo.mechanical) factors.push("기계");
    if (equipmentInfo.chemical) factors.push("화학물질");
    return factors;
  }



  private mergeRegisteredAndAIItems(registeredItems: string[], aiItems: any[]): Array<{name: string; source: string}> {
    const result: Array<{name: string; source: string}> = [];
    
    // Add registered items first
    if (registeredItems && registeredItems.length > 0) {
      registeredItems.forEach(item => {
        if (item && item.trim()) {
          result.push({ name: item.trim(), source: 'registered' });
        }
      });
    }
    
    // Add AI recommended items that are not already registered
    if (aiItems && aiItems.length > 0) {
      aiItems.forEach(aiItem => {
        const itemName = typeof aiItem === 'string' ? aiItem : aiItem.name;
        if (itemName && itemName.trim()) {
          const exists = result.some(existing => 
            existing.name.toLowerCase() === itemName.trim().toLowerCase()
          );
          if (!exists) {
            result.push({ name: itemName.trim(), source: 'ai_recommended' });
          }
        }
      });
    }
    
    return result;
  }





  private async summarizeRegulation(content: string, articleTitle?: string): Promise<string> {
    try {
      if (!content || content.trim().length === 0) {
        return "해당 조문의 내용을 확인할 수 없습니다.";
      }

      // AI를 사용한 실제 조문 내용 요약
      try {
        const prompt = `다음은 산업안전보건 관련 법령 조문입니다. 이 조문의 핵심 내용을 250자 이내로 정확하게 요약해주세요. 

중요: 
- 원문의 내용을 변경하거나 추가하지 말고, 원문의 의미를 그대로 유지하면서 간단히 요약만 해주세요
- 실제 조문에 명시된 안전수칙과 절차만 포함해주세요
- 일반적인 표현이 아닌 구체적인 조문 내용을 요약해주세요

조문 제목: ${articleTitle || ''}

조문 내용:
${content}

250자 이내로 핵심 내용만 요약해주세요.`;

        const response = await timeit(
          `summarizeRegulation AI.generateContent`,
          () => genai.models.generateContent({
            model: "gemini-2.5-flash",
            config: {
              systemInstruction: "당신은 법령 전문가입니다. 주어진 조문의 내용을 정확하게 요약하되, 내용을 변경하거나 왜곡하지 않고 원문의 의미를 그대로 유지합니다.",
            },
            contents: prompt
          })
        );

        const aiSummary = response.text?.trim();
        if (aiSummary && aiSummary.length > 10) {
          const finalSummary = aiSummary.length > 250 ? aiSummary.substring(0, 247) + '...' : aiSummary;
          console.log(`AI 요약 성공: ${finalSummary.substring(0, 50)}...`);
          return finalSummary;
        }
      } catch (aiError) {
        console.log('AI 요약 실패, 원문 추출로 대체:', aiError);
      }

      // AI 실패 시 원본 내용에서 핵심 문장들 추출 (250자 이내)
      console.log('원문에서 핵심 문장 추출 시작');
      const sentences = content.split(/[.。]/).filter(s => s.trim().length > 10);
      const meaningfulSentences = sentences.filter(s => 
        s.includes('하여야') || 
        s.includes('해야') || 
        s.includes('해야 한다') ||
        s.includes('금지') ||
        s.includes('작업자') ||
        s.includes('사업주')
      ).slice(0, 3); // 최대 3개 문장

      if (meaningfulSentences.length > 0) {
        const summary = meaningfulSentences.join('. ').trim();
        return summary.length > 250 ? summary.substring(0, 247) + '...' : summary;
      } else {
        // 첫 번째 유의미한 문장들 사용
        const firstSentences = sentences.slice(0, 2).join('. ');
        return firstSentences.length > 250 ? 
          firstSentences.substring(0, 247) + '...' : 
          firstSentences;
      }

    } catch (error) {
      console.error('조문 요약 생성 실패:', error);
      return "관련 안전규정을 준수하여 작업을 수행해야 합니다.";
    }
  }

  private formatSafetyRegulations(regulations: any[]): string {
    if (!regulations || regulations.length === 0) {
      return "관련 안전규칙이 없습니다.";
    }

    return regulations.map((regulation, index) => {
      const articleTitle = regulation.articleTitle ? `(${regulation.articleTitle})` : '';
      
      return `
【관련법령 ${index + 1}】
${regulation.lawName}
${regulation.articleNumber}${articleTitle}

▣ ${regulation.summary}
    `;
    }).join('\n\n');
  }





  private mapAccidentTypeToSeverity(accidentType: string | undefined): string {
    // 사고 유형에 따른 심각도 매핑
    const highSeverityTypes = ['매몰', '감전', '사망', '화상', '추락'];
    const mediumSeverityTypes = ['끼임', '부딪힘', '절단', '화재'];
    
    if (!accidentType) return 'LOW';
    const accidentTypeLower = accidentType.toLowerCase();
    
    if (highSeverityTypes.some(type => accidentTypeLower.includes(type.toLowerCase()))) {
      return 'HIGH';
    } else if (mediumSeverityTypes.some(type => accidentTypeLower.includes(type.toLowerCase()))) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private formatRisks(equipmentInfo: any): string {
    const risks = [];
    if (equipmentInfo.highVoltageRisk) risks.push("고전압");
    if (equipmentInfo.highPressureRisk) risks.push("고압가스");
    if (equipmentInfo.highTemperatureRisk) risks.push("고온");
    if (equipmentInfo.heightRisk) risks.push("고소");
    if (equipmentInfo.heavyWeightRisk) risks.push("고중량");
    return risks.length > 0 ? risks.join(", ") : "없음";
  }

  private formatEquipmentSpecifications(equipmentInfo: any): string {
    const specs = [];
    if (equipmentInfo.specification) {
      specs.push(`사양: ${equipmentInfo.specification}`);
    }
    if (equipmentInfo.installYear) {
      const age = new Date().getFullYear() - equipmentInfo.installYear;
      specs.push(`사용연수: ${age}년`);
    }
    if (equipmentInfo.manufacturer) {
      specs.push(`제조사: ${equipmentInfo.manufacturer}`);
    }
    return specs.length > 0 ? specs.join(" | ") : "상세 정보 없음";
  }
  async evaluateEquipmentRiskLevel(equipmentInfo: any): Promise<"HIGH" | "MEDIUM" | "LOW"> {
    try {
      const prompt = `다음 산업 설비의 종합적인 위험도를 평가하고 HIGH/MEDIUM/LOW 중 하나로 분류해주세요.

설비 정보:
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 제조사: ${equipmentInfo.manufacturer || '정보 없음'}
- 설치년도: ${equipmentInfo.installYear || '정보 없음'}
- 사양: ${equipmentInfo.specification || '정보 없음'}

위험 요소:
${this.formatRisks(equipmentInfo)}

위험 요소 상세:
- 고전압: ${equipmentInfo.riskFactors?.highVoltage ? 'O' : 'X'} ${equipmentInfo.riskFactors?.highVoltageDetail || ''}
- 고압: ${equipmentInfo.riskFactors?.highPressure ? 'O' : 'X'} ${equipmentInfo.riskFactors?.highPressureDetail || ''}
- 고온: ${equipmentInfo.riskFactors?.highTemperature ? 'O' : 'X'} ${equipmentInfo.riskFactors?.highTemperatureDetail || ''}
- 고소: ${equipmentInfo.riskFactors?.height ? 'O' : 'X'} ${equipmentInfo.riskFactors?.heightDetail || ''}
- 기계적: ${equipmentInfo.riskFactors?.mechanical ? 'O' : 'X'} ${equipmentInfo.riskFactors?.mechanicalDetail || ''}

유해화학물질: ${equipmentInfo.hazardousChemicalType || '없음'}
필수 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(', ') || '기본 안전장비'}

평가 기준:
- HIGH: 생명에 직접적 위험, 중대재해 가능성, 복수 고위험 요소
- MEDIUM: 부상 가능성, 단일 위험 요소, 적절한 안전조치로 관리 가능
- LOW: 경미한 위험, 기본 안전수칙으로 충분

위험도만 응답하세요: HIGH, MEDIUM, LOW 중 하나`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "산업안전 전문가로서 설비의 종합 위험도를 평가합니다. HIGH, MEDIUM, LOW 중 하나만 응답하세요."
        },
        contents: prompt
      });

      const result = response.text?.trim().toUpperCase();
      
      if (result === 'HIGH' || result === 'MEDIUM' || result === 'LOW') {
        return result as "HIGH" | "MEDIUM" | "LOW";
      }
      
      return "MEDIUM"; // 기본값
    } catch (error) {
      console.error("AI 위험도 평가 오류:", error);
      return "MEDIUM";
    }
  }

  async analyzeWorkTypeRisk(workTypeId: number, workTypeName: string, equipmentInfo: any): Promise<{
    workTypeName: string;
    riskFactors: Array<{
      factor: string;
      probability: number; // 1-5
      severity: number; // 1-4
      score: number; // probability × severity
      measures: string[];
    }>;
    totalScore: number;
    overallRiskLevel: "HIGH" | "MEDIUM" | "LOW";
    complianceNotes: string[];
  }> {
    try {
      const prompt = `${workTypeName} 작업에 대한 산업안전보건법 기준 위험성평가를 수행해주세요.

설비 정보:
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 주요 위험요소: ${this.formatRisks(equipmentInfo)}
- 고온위험: ${equipmentInfo.highTemperatureRisk ? '있음' : '없음'}
- 고압위험: ${equipmentInfo.highPressureRisk ? '있음' : '없음'}
- 전기위험: ${equipmentInfo.electricalRisk ? '있음' : '없음'}
- 회전체위험: ${equipmentInfo.rotatingPartsRisk ? '있음' : '없음'}

작업 유형: ${workTypeName}

다음 기준으로 위험성평가를 수행하고 JSON 형태로 응답해주세요:

1. 위험요소별 평가:
   - 발생가능성 (1-5점): 1=거의없음, 2=희박, 3=가능, 4=자주발생, 5=항상발생
   - 심각도 (1-4점): 1=경미, 2=중간, 3=심각, 4=치명적
   - 위험점수 = 발생가능성 × 심각도 (최대 20점)

2. 위험요소는 최소 3개 이상 포함:
   - 물리적 위험 (고온, 고압, 전기, 회전체 등)
   - 화학적 위험 (해당시)
   - 인간공학적 위험 (작업자세, 반복작업 등)
   - 기타 작업 특성에 따른 위험

3. 각 위험요소별 구체적인 대응조치 3개 이상

4. 산업안전보건법 준수사항 포함

응답 형식:
{
  "workTypeName": "${workTypeName}",
  "riskFactors": [
    {
      "factor": "위험요소명",
      "probability": 발생가능성점수,
      "severity": 심각도점수,
      "score": 위험점수,
      "measures": ["대응조치1", "대응조치2", "대응조치3"]
    }
  ],
  "totalScore": 총점,
  "overallRiskLevel": "HIGH/MEDIUM/LOW",
  "complianceNotes": ["산업안전보건법 준수사항1", "준수사항2"]
}

전체 위험도 기준:
- HIGH: 총점 15점 이상
- MEDIUM: 총점 8-14점
- LOW: 총점 7점 이하`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 한국의 산업안전보건법 전문가입니다. 정확한 위험성평가를 수행하고 법적 요구사항에 맞는 안전조치를 제시합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              workTypeName: { type: "string" },
              riskFactors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    factor: { type: "string" },
                    probability: { type: "number", minimum: 1, maximum: 5 },
                    severity: { type: "number", minimum: 1, maximum: 4 },
                    score: { type: "number" },
                    measures: { type: "array", items: { type: "string" } }
                  },
                  required: ["factor", "probability", "severity", "score", "measures"]
                }
              },
              totalScore: { type: "number" },
              overallRiskLevel: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              complianceNotes: { type: "array", items: { type: "string" } }
            },
            required: ["workTypeName", "riskFactors", "totalScore", "overallRiskLevel", "complianceNotes"]
          },
          temperature: 0.3
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
      // Calculate total score
      const totalScore = result.riskFactors?.reduce((sum: number, risk: any) => sum + risk.score, 0) || 0;
      
      // Determine overall risk level
      let overallRiskLevel = "LOW";
      if (totalScore >= 15) overallRiskLevel = "HIGH";
      else if (totalScore >= 8) overallRiskLevel = "MEDIUM";

      return {
        workTypeName: result.workTypeName || workTypeName,
        riskFactors: result.riskFactors || [],
        totalScore,
        overallRiskLevel: overallRiskLevel as "HIGH" | "MEDIUM" | "LOW",
        complianceNotes: result.complianceNotes || []
      };
    } catch (error) {
      console.error("AI 위험성평가 오류:", error);
      
      // Fallback risk assessment
      return {
        workTypeName,
        riskFactors: [
          {
            factor: "고압 가스 노출",
            probability: 3,
            severity: 4,
            score: 12,
            measures: [
              "작업 전 압력 완전 해제 확인",
              "개인보호구 착용 의무화",
              "안전작업절차서 숙지 및 준수"
            ]
          },
          {
            factor: "전기적 위험",
            probability: 2,
            severity: 4,
            score: 8,
            measures: [
              "전원 차단 후 작업 실시",
              "절연장갑 착용",
              "전기 안전 점검 실시"
            ]
          },
          {
            factor: "회전체 접촉",
            probability: 2,
            severity: 3,
            score: 6,
            measures: [
              "회전부 완전 정지 확인",
              "안전덮개 설치 확인",
              "느슨한 의복 착용 금지"
            ]
          }
        ],
        totalScore: 26,
        overallRiskLevel: "HIGH",
        complianceNotes: [
          "산업안전보건법 제38조에 따른 위험성평가 실시",
          "동법 제39조에 따른 안전보건조치 이행",
          "개인보호구 지급 및 착용 의무 (동법 제32조)",
          "안전작업절차서 작성 및 교육 실시 (동법 제31조)"
        ]
      };
    }
  }

  async generateSafetyBriefing(
    workSchedule: any,
    equipment: any,
    workType: any,
    weatherInfo: any,
    ragData: {
      regulations: any[];
      incidents: any[];
      educationMaterials: any[];
      quizQuestions: any[];
      safetySlogan: string;
    }
  ): Promise<{
    workSummary: string;
    riskFactors: string[];
    riskAssessment: any;
    requiredTools: string[];
    requiredSafetyEquipment: string[];
    weatherConsiderations: string[];
    safetyRecommendations: string[];
  }> {
    try {
      const prompt = `다음 정보를 바탕으로 종합적인 AI 안전 브리핑을 생성해주세요.

작업 일정 정보:
- 작업일: ${new Date(workSchedule.scheduledDate).toLocaleDateString('ko-KR')}
- 작업자: ${workSchedule.workerName}
- 작업 설명: ${workSchedule.workDescription || ''}
- 작업 물량: ${workSchedule.workVolume || '표준'}
- 작업 범위: ${workSchedule.workScope || '일반'}

설비 정보:
- 설비명: ${equipment.name}
- 위치: ${equipment.location}
- 제조사: ${equipment.manufacturer || '정보 없음'}
- 설치연도: ${equipment.installYear || '정보 없음'}
- 주요 위험요소: ${this.formatRisks(equipment)}

작업 유형:
- 작업명: ${workType.name}
- 설명: ${workType.description || ''}
- 예상 소요시간: ${workType.estimatedDuration || 60}분
- 허가 필요: ${workType.requiresPermit ? '예' : '아니오'}

${weatherInfo ? `날씨 정보:
- 위치: ${weatherInfo.location}
- 기온: ${weatherInfo.temperature}°C
- 습도: ${weatherInfo.humidity}%
- 풍속: ${weatherInfo.windSpeed}m/s
- 날씨: ${weatherInfo.condition}
- 안전 경고: ${weatherInfo.safetyWarnings.join(', ')}` : '날씨 정보: API 연결 실패로 실시간 날씨 정보를 가져올 수 없습니다. 현장에서 직접 날씨 상황을 확인하세요.'}

관련 법규: ${ragData.regulations.map(r => r.title).join(', ')}
관련 사고사례: ${ragData.incidents.length}건
교육자료: ${ragData.educationMaterials.length}건

다음 형식으로 JSON 응답을 제공해주세요:
{
  "workSummary": "작업 내용 종합 요약 (물량, 범위 포함)",
  "riskFactors": ["주요 위험요인1", "주요 위험요인2", ...],
  "requiredTools": ["필요한 작업도구1", "필요한 작업도구2", ...],
  "requiredSafetyEquipment": ["필요한 안전장비1", "필요한 안전장비2", ...],
  "weatherConsiderations": ["날씨 고려사항1", "날씨 고려사항2", ...],
  "safetyRecommendations": ["안전 권고사항1", "안전 권고사항2", ...]
}`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 산업 안전 전문가입니다. 종합적이고 실용적인 안전 브리핑을 생성합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              workSummary: { type: "string" },
              riskFactors: { type: "array", items: { type: "string" } },
              requiredTools: { type: "array", items: { type: "string" } },
              requiredSafetyEquipment: { type: "array", items: { type: "string" } },
              weatherConsiderations: { type: "array", items: { type: "string" } },
              safetyRecommendations: { type: "array", items: { type: "string" } }
            },
            required: ["workSummary", "riskFactors", "requiredTools", "requiredSafetyEquipment", "weatherConsiderations", "safetyRecommendations"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");

      // Generate risk assessment
      const riskAssessment = await this.analyzeWorkTypeRisk(
        workType.id,
        workType.name,
        equipment
      );

      return {
        workSummary: result.workSummary || `${workType.name} 작업을 ${equipment.name}에서 수행합니다.`,
        riskFactors: result.riskFactors || ["설비 특성상 위험 요소 확인 필요"],
        riskAssessment,
        requiredTools: result.requiredTools || ["기본 작업도구", "점검용 계측기"],
        requiredSafetyEquipment: result.requiredSafetyEquipment || ["안전모", "안전화", "보호안경"],
        weatherConsiderations: result.weatherConsiderations || [`${weatherInfo.condition} 날씨 고려`],
        safetyRecommendations: result.safetyRecommendations || ["작업 전 안전점검 실시", "LOTO 절차 준수"]
      };
    } catch (error) {
      console.error("AI 안전 브리핑 생성 오류:", error);
      
      // Fallback briefing
      const riskAssessment = await this.analyzeWorkTypeRisk(
        workType.id,
        workType.name,
        equipment
      );

      return {
        workSummary: `${workType.name} 작업을 ${equipment.name}에서 안전하게 수행합니다.`,
        riskFactors: ["설비 고유 위험성", "작업 환경 위험성"],
        riskAssessment,
        requiredTools: ["표준 작업도구", "안전 점검 도구"],
        requiredSafetyEquipment: ["안전모", "안전화", "보호안경", "안전장갑"],
        weatherConsiderations: [`현재 날씨: ${weatherInfo.condition}`],
        safetyRecommendations: ["작업 전 안전점검", "표준 작업절차 준수", "비상연락망 확인"]
      };
    }
  }
}

export const aiService = new AIService();
