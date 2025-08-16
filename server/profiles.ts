// profiles.ts
// 범용 프로파일 기반 쿼리 빌더 & 하이브리드 스코어러

import * as fs from 'fs';
import * as path from 'path';

export type WorkType = { id?: string; name: string };
export type EquipmentInfo = {
  id?: string;
  name: string;            // 예: "170kV GIS", "유압펌프"
  tags?: string[];         // 예: ["electrical", "substation", "gis"]
  riskTags?: string[];     // 예: ["감전", "고소", "압력"]
  metadata?: Record<string, any>;
};

export type SearchItem = {
  id?: string;
  title?: string;
  text?: string;           // 본문
  content?: string;        // 대체 콘텐츠 필드
  metadata?: {
    sourceType?: "regulation" | "education" | "accident" | string;
    work_type?: string;
    equipment?: string;
    risk_keywords?: string;  // comma-separated 가능
    [k: string]: any;
  };
  vectorScore?: number;    // 0..1 (임베딩 유사도 점수)
};

// ------------------ Profiles ------------------

export interface ProfileMatch {
  equipment_name_regex?: string;   // JS RegExp 문자열
  tags_any?: string[];
  work_types_any?: string[];
  risk_tags_any?: string[];
}

export interface ProfileWeights {
  vector: number;
  keyword: number;
  equipment: number;
  work_type: number;
  risk: number;
  regulation_hit: number;
  education_hit: number;
}

export interface ProfileQueries {
  accidents?: string[];
  regulation?: string[];
  education?: string[];
}

export interface Profile {
  id: string;
  description?: string;
  match?: ProfileMatch;
  keywords?: string[];
  exclude_keywords?: string[];
  include_if_any_keywords?: string[];
  exclude_if_any_keywords?: string[];
  queries?: ProfileQueries;
  weights: ProfileWeights;
}

export interface SearchProfilesConfig {
  version?: string;
  profiles: Profile[];
}

// ------------------ Loader & Resolver ------------------

let cachedProfiles: Profile[] | null = null;

export function loadProfiles(): Profile[] {
  // 개발 중에는 항상 재로드 (캐시 무효화)
  if (process.env.NODE_ENV === 'development') {
    cachedProfiles = null;
  }
  
  if (cachedProfiles) return cachedProfiles;
  
  try {
    const configPath = path.join(process.cwd(), 'config', 'search-profiles.json');
    const json = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as SearchProfilesConfig;
    
    if (!json?.profiles?.length) {
      throw new Error("profiles empty");
    }
    
    cachedProfiles = json.profiles;
    return cachedProfiles;
  } catch (error) {
    console.error('프로파일 로딩 실패, 기본 프로파일 사용:', error);
    // 기본 프로파일 반환
    cachedProfiles = [{
      id: "default",
      description: "기본 프로파일",
      keywords: ["안전", "점검", "정비", "위험성 평가"],
      queries: {
        accidents: ["안전사고", "작업사고"],
        regulation: ["안전규정", "작업기준"],
        education: ["안전교육", "작업안전"]
      },
      weights: {
        vector: 0.60,
        keyword: 0.15,
        equipment: 0.10,
        work_type: 0.07,
        risk: 0.05,
        regulation_hit: 0.02,
        education_hit: 0.01
      }
    }];
    return cachedProfiles;
  }
}

export function resolveProfile(
  equipment: EquipmentInfo,
  workType?: WorkType
): Profile {
  const profiles = loadProfiles();
  const name = equipment?.name ?? "";
  const tags = new Set((equipment?.tags ?? []).map((t) => t.toLowerCase()));
  const work = (workType?.name ?? "").toLowerCase();
  const riskTags = new Set((equipment?.riskTags ?? []).map((t) => t.toLowerCase()));

  console.log(`[프로파일 해석] 설비: "${name}", 작업: "${work}", 태그: [${Array.from(tags).join(', ')}]`);

  for (const p of profiles) {
    const m = p.match;
    if (!m) continue;

    const nameOk = m.equipment_name_regex
      ? new RegExp(m.equipment_name_regex, 'i').test(name)
      : true;

    const tagsOk = m.tags_any?.length
      ? m.tags_any.some((t) => tags.has(t.toLowerCase()))
      : true;

    const workOk = m.work_types_any?.length
      ? m.work_types_any.some((w) => work.includes(w.toLowerCase()))
      : true;

    const riskOk = m.risk_tags_any?.length
      ? m.risk_tags_any.some((r) => riskTags.has(r.toLowerCase()))
      : true;

    if (nameOk && tagsOk && workOk && riskOk) {
      console.log(`[프로파일 매칭] "${p.id}" (${p.description}) 선택됨`);
      return p;
    }
  }

  // fallback: id === 'default' or 첫 프로파일
  const fallback = profiles.find((p) => p.id === "default") ?? profiles[0];
  console.log(`[프로파일 폴백] "${fallback.id}" 사용`);
  return fallback;
}

// ------------------ Query Builder ------------------

export interface BuiltQueries {
  accidents: string[];
  regulation: string[];
  education: string[];
  all: string[]; // dedup한 전체 쿼리
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean).map((s) => s.trim())));
}

function tokenize(str = ""): string[] {
  return str
    .split(/[\s·,|/\\]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildTargetedSearchQuery(
  profile: Profile,
  equipment: EquipmentInfo,
  workType?: WorkType
): BuiltQueries {
  const nameTokens = tokenize(equipment?.name);
  const wtTokens = tokenize(workType?.name);
  const eqTags = (equipment?.tags ?? []).map((t) => t.toLowerCase());
  const risk = (equipment?.riskTags ?? []).map((t) => t.toLowerCase());

  const baseKeywords = profile.keywords ?? [];

  const dynamicHead = [
    [...nameTokens, ...eqTags].join(" ").trim(),
    wtTokens.join(" ").trim(),
    risk.join(" ").trim()
  ].filter(Boolean);

  // 규정/교육/사고 쿼리 구성: 프로파일 기본 + 동적 키워드 접합
  const accidents = uniq([
    ...((profile.queries?.accidents ?? []).map((q) => `${q}`)),
    ...(dynamicHead.length ? [`${dynamicHead.join(" ")} 사고`] : [])
  ]);

  const regulation = uniq([
    ...((profile.queries?.regulation ?? []).map((q) => `${q}`)),
    ...(dynamicHead.length ? [`${dynamicHead.join(" ")} 안전기준`] : [])
  ]);

  const education = uniq([
    ...((profile.queries?.education ?? []).map((q) => `${q}`)),
    ...(dynamicHead.length ? [`${dynamicHead.join(" ")} 안전교육`] : [])
  ]);

  const all = uniq([...accidents, ...regulation, ...education]);

  console.log(`[쿼리 빌드] 프로파일: ${profile.id}`);
  console.log(`  사고쿼리 ${accidents.length}건:`, accidents.slice(0, 3));
  console.log(`  법규쿼리 ${regulation.length}건:`, regulation.slice(0, 3));
  console.log(`  교육쿼리 ${education.length}건:`, education.slice(0, 3));

  return { accidents, regulation, education, all };
}

// ------------------ Universal Hybrid Scorer ------------------

export function computeUniversalHybridScore(
  item: SearchItem,
  profile: Profile,
  equipment: EquipmentInfo,
  workType?: WorkType
): number {
  const w = profile.weights;
  const text = (item.text ?? item.title ?? "").toLowerCase();
  const meta = item.metadata ?? {};
  
  // 1) 벡터 점수 (0~1)
  const vectorScore = item.vectorScore ?? 0;

  // 2) 키워드 매칭 점수
  const keywords = profile.keywords ?? [];
  let keywordHits = 0;
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) keywordHits++;
  }
  const keywordScore = keywords.length > 0 ? keywordHits / keywords.length : 0;

  // 3) 설비명 매칭
  const equipmentName = equipment?.name?.toLowerCase() ?? "";
  const equipmentScore = equipmentName && text.includes(equipmentName) ? 1 : 0;

  // 4) 작업유형 매칭
  const workTypeName = workType?.name?.toLowerCase() ?? "";
  const workTypeScore = workTypeName && text.includes(workTypeName) ? 1 : 0;

  // 5) 위험 키워드 매칭
  const riskTags = equipment?.riskTags ?? [];
  let riskHits = 0;
  for (const risk of riskTags) {
    if (text.includes(risk.toLowerCase())) riskHits++;
  }
  const riskScore = riskTags.length > 0 ? riskHits / riskTags.length : 0;

  // 6) 소스 타입별 가중치
  const sourceType = meta.sourceType ?? meta.type ?? "";
  const regulationHit = sourceType === "regulation" ? 1 : 0;
  const educationHit = sourceType === "education" ? 1 : 0;

  // 최종 하이브리드 점수 계산
  const hybridScore = 
    w.vector * vectorScore +
    w.keyword * keywordScore +
    w.equipment * equipmentScore +
    w.work_type * workTypeScore +
    w.risk * riskScore +
    w.regulation_hit * regulationHit +
    w.education_hit * educationHit;

  return hybridScore;
}

// ------------------ Content Filtering ------------------

export function shouldIncludeContent(
  item: SearchItem,
  profile: Profile
): boolean {
  const text = (item.text ?? item.title ?? "").toLowerCase();
  
  // 제외 키워드 체크
  const excludeKeywords = profile.exclude_keywords ?? [];
  for (const exclude of excludeKeywords) {
    if (text.includes(exclude.toLowerCase())) {
      return false;
    }
  }

  // 제외 조건 키워드 체크 (강화된 산업별 필터링)
  const excludeIfAny = profile.exclude_if_any_keywords ?? [];
  if (excludeIfAny.length > 0) {
    for (const exclude of excludeIfAny) {
      if (text.includes(exclude.toLowerCase())) {
        return false;
      }
    }
  }



  // 포함 조건 키워드 체크 (강화된 관련성 확인)
  const includeIfAny = profile.include_if_any_keywords ?? [];
  if (includeIfAny.length > 0) {
    let hasRequiredKeyword = false;
    for (const include of includeIfAny) {
      if (text.includes(include.toLowerCase())) {
        hasRequiredKeyword = true;
        break;
      }
    }
    if (!hasRequiredKeyword) {
      return false;
    }
  }

  return true;
}

// ------------------ Equipment Tag Inference ------------------

export function inferEquipmentTags(equipment: EquipmentInfo | string, profile?: Profile): string[] {
  const name = typeof equipment === 'string' ? equipment.toLowerCase() : equipment.name.toLowerCase();
  const tags: string[] = [];

  // 전기 관련
  if (/전기|gis|sf6|변전|고압|특별고압|170kv|절연|충전부/.test(name)) {
    tags.push("electrical");
    if (/gis|변전|sf6/.test(name)) tags.push("substation", "gis");
  }

  // 기계 관련
  if (/회전|축|베어링|터빈|모터|펌프|기계/.test(name)) {
    tags.push("mechanical");
    if (/회전|축/.test(name)) tags.push("rotating");
  }

  // 유압/압력 관련
  if (/유압|압력|배관|밸브|탱크/.test(name)) {
    tags.push("hydraulic", "pressure");
  }

  // 컨베이어 관련
  if (/컨베이어|벨트|이송/.test(name)) {
    tags.push("conveyor", "transport");
  }

  // 고소작업 관련
  if (/크레인|높이|고소/.test(name)) {
    tags.push("height", "crane");
  }

  return tags;
}

export function inferRiskTags(equipment: EquipmentInfo | string, profile?: Profile): string[] {
  const name = typeof equipment === 'string' ? equipment.toLowerCase() : equipment.name.toLowerCase();
  const workTypeName = typeof equipment === 'string' ? '' : (equipment.workType || '');
  const combined = `${name} ${workTypeName}`.toLowerCase();
  const risks: string[] = [];

  if (/전기|감전|고압|충전/.test(combined)) risks.push("감전");
  if (/회전|축|끼임/.test(combined)) risks.push("끼임");
  if (/압력|폭발|파열/.test(combined)) risks.push("압력");
  if (/높이|추락|고소/.test(combined)) risks.push("추락");
  if (/화재|폭발|가연/.test(combined)) risks.push("화재");
  if (/유해|화학|독성/.test(combined)) risks.push("유해물질");

  return risks;
}