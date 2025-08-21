// profiles.ts
// 범용 프로파일 기반 쿼리 빌더 & 하이브리드 스코어러

// TypeScript 통합 프로파일 시스템 - JSON 파일 의존성 제거

export type WorkType = { id?: string; name: string };
export type EquipmentInfo = {
  id?: string;
  name: string;            // 예: "170kV GIS", "유압펌프"
  tags?: string[];         // 예: ["electrical", "substation", "gis"]
  riskTags?: string[];     // 예: ["감전", "고소", "압력"]
  metadata?: Record<string, any>;
};

export type SearchItem = {
  id: string;
  title?: string;
  text?: string;           // 본문
  content?: string;        // 추가 본문(외부 호출부에서 주로 여기에 채움)
  metadata?: {
    sourceType?: "regulation" | "education" | "accident" | string;
    work_type?: string;
    equipment?: string;
    risk_keywords?: string;  // comma-separated 가능
    industry?: string;
    tags?: string[];
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

// 프로파일 데이터 정의 (통합)
const SEARCH_PROFILES: Profile[] = [
  {
    id: "electrical-hv-gis",
    description: "전기 · 특별고압 · GIS/SF6/변전 설비",
    match: {
      equipment_name_regex: "(170\\s*kv|gis|sf6|변전|가스절연|전기)",
      tags_any: ["electrical", "substation", "gis"]
    },
    keywords: [
      "GIS", "SF6", "가스절연", "변전소", "개폐기", "고전압", "특별고압",
      "절연", "충전부", "감전", "절연장갑", "활선", "전기"
    ],
    exclude_keywords: ["캄보디아", "베트남", "몽골"],
    include_if_any_keywords: ["전기", "고압", "절연", "변전", "GIS", "170kV", "SF6", "가스절연", "충전부", "개폐기", "감전", "전력", "전압"],
    exclude_if_any_keywords: ["식품가공", "농업용", "관광업"],
    queries: {
      accidents: [
        "변전소 감전 사고", "개폐기 조작 감전", "특별고압 접촉 사고", "전기작업 감전"
      ],
      regulation: [
        "전기기계기구 안전조치", "감전방지", "전로에서 전기작업", "과전류 차단", "전기작업자", "전기기계기구"
      ],
      education: [
        "고압 전기 안전교육", "GIS 운영 교육", "SF6 취급 안전", "전기작업 안전"
      ]
    },
    weights: {
      vector: 0.55,
      keyword: 0.15,
      equipment: 0.10,
      work_type: 0.08,
      risk: 0.07,
      regulation_hit: 0.03,
      education_hit: 0.02
    }
  },
  {
    id: "mechanical-rotating",
    description: "기계 · 회전체/축계/베어링",
    match: { 
      equipment_name_regex: "(회전|축|베어링|터빈|모터|펌프)",
      tags_any: ["mechanical", "rotating"] 
    },
    keywords: [
      "회전체", "커플링", "축정렬", "베어링", "윤활", "진동", "정비", "기계"
    ],
    exclude_keywords: [],
    queries: {
      accidents: ["회전체 끼임 사고", "정비 중 협착", "기계 사고"],
      regulation: ["회전체 위험 방호", "가동부 방호덮개", "기계설비 안전"],
      education: ["베어링 윤활 교육", "축정렬 실습", "기계 안전작업"]
    },
    weights: {
      vector: 0.55,
      keyword: 0.18,
      equipment: 0.10,
      work_type: 0.07,
      risk: 0.07,
      regulation_hit: 0.02,
      education_hit: 0.01
    }
  },
  {
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
  }
];

export function loadProfiles(): Profile[] {
  if (cachedProfiles) {
    console.log(`[profiles] cached: ${cachedProfiles.length} loaded`);
    return cachedProfiles;
  }
  
  cachedProfiles = SEARCH_PROFILES;
  console.log(`[profiles] loaded: ${cachedProfiles.length} profiles from TypeScript`);
  return cachedProfiles;
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

// 공통 텍스트 블롭 생성 유틸: title/text/content/metadata를 묶어 판단 정확도 개선
function toTextBlob(item: SearchItem): string {
  const parts = [
    item.title ?? "",
    item.text ?? "",
    item.content ?? "",
    item.metadata ? JSON.stringify(item.metadata) : ""
  ];
  return parts.join(" ").toLowerCase();
}

// 프로파일 기반 포함/제외 1차 판단 (사고/교육/법규 공통 사용)
export function shouldIncludeContent(item: SearchItem, profile: Profile): boolean {
  const hay = toTextBlob(item);
  const ex = (profile.exclude_keywords ?? []).map((x) => x.toLowerCase());
  const exAny = (profile.exclude_if_any_keywords ?? []).map((x) => x.toLowerCase());
  const incAny = (profile.include_if_any_keywords ?? []).map((x) => x.toLowerCase());

  if (ex.length && ex.some((k) => hay.includes(k))) return false;
  if (exAny.length && exAny.some((k) => hay.includes(k))) return false;
  if (incAny.length && incAny.some((k) => hay.includes(k))) return true;
  // include_if_any가 없으면 보수적으로 true를 반환하고, 스코어 단계에서 걸러짐
  return true;
}

export function buildTargetedSearchQuery(
  profile: Profile,
  equipment: EquipmentInfo,
  workType?: WorkType,
  cachedTokens?: {
    nameTokens: string[];
    wtTokens: string[];
    eqTags: string[];
    riskTags: string[];
    isElectricalEquipment: boolean;
  }
): BuiltQueries {
  // 캐시된 토큰이 있으면 재사용, 없으면 새로 생성
  const { nameTokens, wtTokens, eqTags, riskTags, isElectricalEquipment } = cachedTokens || {
    nameTokens: tokenize(equipment?.name),
    wtTokens: tokenize(workType?.name),
    eqTags: (equipment?.tags ?? []).map((t) => t.toLowerCase()),
    riskTags: (equipment?.riskTags ?? []).map((t) => t.toLowerCase()),
    isElectricalEquipment: equipment?.name?.includes('kV') || 
                          equipment?.name?.includes('GIS') ||
                          equipment?.name?.includes('변압기') ||
                          equipment?.name?.includes('배전') ||
                          equipment?.name?.includes('전기')
  };

  const baseKeywords = profile.keywords ?? [];

  // 핵심 키워드만 선별하여 dynamicHead 생성 (219자 문제 해결)
  const coreEqTags = eqTags.filter(tag => 
    // 전기설비: 핵심 안전 키워드만
    isElectricalEquipment ? 
      ['감전', '절연장갑', '충전부', '개폐기', 'sf6'].includes(tag.toLowerCase()) :
      // 일반설비: 첫 3개 태그만
      true
  ).slice(0, 3);
  
  const coreRiskTags = riskTags.filter(tag => 
    // 핵심 위험 키워드만 (1글자 단어, 접속사 제외)
    tag.length > 1 && !['및', '시', '의', '에서', '까지', '위험'].includes(tag)
  ).slice(0, 3);

  const dynamicHead = [
    [...nameTokens, ...coreEqTags].join(" ").trim(),
    wtTokens.join(" ").trim(),
    coreRiskTags.join(" ").trim()
  ].filter(Boolean);

  // 규정/교육/사고 쿼리 구성: 프로파일 기본 + 동적 키워드 접합
  const accidents = uniq([
    ...((profile.queries?.accidents ?? []).map((q) => `${q}`)),
    ...(dynamicHead.length ? [
      `${dynamicHead.join(" ")} 사고`,
      // 전기 설비의 경우 더 구체적인 쿼리 추가
      ...(isElectricalEquipment ? [
        `${nameTokens.join(" ")} 감전 사고`,
        `${nameTokens.join(" ")} 정전 사고`,
        `고압 전기설비 ${wtTokens.join(" ")} 사고`
      ] : [])
    ] : [])
  ]);

  const regulation = uniq([
    ...((profile.queries?.regulation ?? []).map((q) => `${q}`)),
    ...(dynamicHead.length ? [
      `${dynamicHead.join(" ")} 안전기준`,
      // 전기 설비의 경우 더 구체적인 규정 검색
      ...(isElectricalEquipment ? [
        `${nameTokens.join(" ")} 전기안전기준`,
        `고압설비 ${wtTokens.join(" ")} 규정`
      ] : [])
    ] : [])
  ]);

  const education = uniq([
    ...((profile.queries?.education ?? []).map((q) => `${q}`)),
    ...(dynamicHead.length ? [
      `${dynamicHead.join(" ")} 안전교육`,
      // 전기 설비의 경우 더 구체적인 교육자료 검색
      ...(isElectricalEquipment ? [
        `${nameTokens.join(" ")} 전기안전교육`,
        `고압설비 안전작업 교육`
      ] : [])
    ] : [])
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

// ------------------ Enhanced Hybrid Scoring ------------------

// Helper functions for scoring
function containsAny(text: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) hits++;
  }
  return hits;
}

function normalize(score: number, max: number): number {
  return max > 0 ? Math.min(score / max, 1) : 0;
}

export type HybridScoreOptions = {
  textFields?: string[];
  bonusForIncludedAny?: number;
  penaltyForExcluded?: number;
};

const DEFAULT_OPTS: HybridScoreOptions = {
  textFields: ['title', 'text', 'content'],
  bonusForIncludedAny: 0.1,
  penaltyForExcluded: 0.2
};

export function applyHybridScoring(
  item: SearchItem,
  profile: Profile,
  equipment: EquipmentInfo,
  workType?: WorkType,
  opts: HybridScoreOptions = {}
): number {
  const o = { ...DEFAULT_OPTS, ...opts };
  // content까지 포함해 판단 (기존 title/text만 보던 문제 수정)
  const text = toTextBlob(item);

  const eqTokens = tokenize(equipment?.name).concat((equipment?.tags ?? []));
  const wtTokens = tokenize(workType?.name);
  const riskTokens = (equipment?.riskTags ?? []);

  const vec = Math.max(0, Math.min(1, item.vectorScore ?? 0));

  const kwHits = containsAny(text, profile.keywords ?? []);
  const eqHits = containsAny(text, eqTokens);
  const wtHits = containsAny(text, wtTokens);
  const riskHits = containsAny(text, riskTokens);

  const includeAny = profile.include_if_any_keywords ?? [];
  const exclude = profile.exclude_keywords ?? [];
  const exclAny = profile.exclude_if_any_keywords ?? [];

  let bonus = 0;
  if (includeAny.length && containsAny(text, includeAny) > 0) bonus += (o.bonusForIncludedAny || 0.1);
  let penalty = 0;
  if (exclude.length && containsAny(text, exclude) > 0) penalty += Math.abs(o.penaltyForExcluded || 0.2);
  if (exclAny.length && containsAny(text, exclAny) > 0) penalty += Math.abs(o.penaltyForExcluded || 0.2);

  const st = item.metadata?.sourceType;
  const regHit = st === "regulation" ? 1 : 0;
  const eduHit = st === "education" ? 1 : 0;

  const s_kw = normalize(kwHits, 8);
  const s_eq = normalize(eqHits, 6);
  const s_wt = normalize(wtHits, 4);
  const s_rk = normalize(riskHits, 4);

  const w = profile.weights;

  let score = 0;
  score += w.vector * vec;
  score += w.keyword * s_kw;
  score += w.equipment * s_eq;
  score += w.work_type * s_wt;
  score += w.risk * s_rk;
  score += w.regulation_hit * regHit;
  score += w.education_hit * eduHit;

  score += bonus;
  score -= penalty;

  return Math.max(0, Math.min(1, score));
}

// ------------------ Equipment Tag Inference ------------------

export function inferEquipmentTags(equipment: EquipmentInfo | string, profile?: Profile): string[] {
  const name = typeof equipment === 'string' ? equipment.toLowerCase() : equipment.name.toLowerCase();
  const tags: string[] = [];

  // 전기 관련
  if (/전기|gis|sf6|변전|고압|특별고압|170kv|절연|충전부/.test(name)) {
    tags.push("전기작업","정전전로","충전전로(활선)","감전","차단·개로","단로기","잠금·표찰(LOTO)","접지","밀폐공간","추락방지","차단기","단로기","변류기","계기용변압기","SF6 가스","가스밀도 검출기","유압");
    // 영어 태그 추가 (프로파일 매칭용)
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
  const workTypeName = typeof equipment === 'string' ? '' : '';
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