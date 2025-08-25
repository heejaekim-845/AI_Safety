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
  priority_keywords?: { [keyword: string]: number }; // 키워드별 추가 부스팅 점수
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
    exclude_keywords: ["캄보디아", "베트남", "몽골", "발파", "다이나마이트", "화약", "잠함", "콘크리트", "타설", "방사성물질", "탱크", "낙반"],
    include_if_any_keywords: ["전기", "고압", "절연", "변전", "GIS", "170kV", "SF6", "가스절연", "충전부", "개폐기", "감전", "전력", "전압"],
    exclude_if_any_keywords: ["식품가공", "농업용", "관광업", "발파작업", "잠함", "콘크리트", "화학설비", "파열판"],
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
    },
    priority_keywords: {
      "감전": 0.20,        // 감전 키워드 발견시 +20% 부스팅
      "충전부": 0.15,      // 충전부 키워드 발견시 +15% 부스팅
      "절연장갑": 0.15,    // 절연장갑 키워드 발견시 +15% 부스팅
      "활선": 0.15,        // 활선 키워드 발견시 +15% 부스팅
      "GIS": 0.10,         // GIS 키워드 발견시 +10% 부스팅
      "170kV": 0.10        // 170kV 키워드 발견시 +10% 부스팅
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
    id: "turbine-hydro",
    description: "수차 · 수력발전 · 회전기계",
    match: {
      equipment_name_regex: "(수차|turbine|발전기|터빈|회전)",
      tags_any: ["turbine", "hydro", "rotating", "mechanical"]
    },
    keywords: [
      "수차", "터빈", "회전체", "발전기", "베어링", "축정렬", "진동", "윤활",
      "회전기계", "RPM", "축", "커플링", "정비", "점검", "기계"
    ],
    exclude_keywords: ["전기", "변압기", "송전", "배전", "고압"],
    include_if_any_keywords: ["수차", "터빈", "회전", "발전기", "기계", "베어링", "윤활", "진동", "축"],
    exclude_if_any_keywords: ["전기작업", "송전선", "변압기", "개폐기"],
    queries: {
      accidents: [
        "수차 정비 중 끼임", "회전체 끼임 사고", "터빈 점검 중 사고", "발전기 정비 사고"
      ],
      regulation: [
        "회전체 위험 방호", "가동부 방호덮개", "기계설비 안전", "회전기계 점검"
      ],
      education: [
        "수차 안전교육", "회전기계 안전작업", "베어링 정비 교육", "터빈 점검 안전"
      ]
    },
    weights: {
      vector: 0.50,      // 벡터 유사도 (50%)
      keyword: 0.25,     // 키워드 매칭 (25%) - 높음!
      equipment: 0.15,   // 설비 매칭 (15%) - 높음!
      work_type: 0.05,   // 작업유형 (5%)
      risk: 0.03,        // 위험요소 (3%)
      regulation_hit: 0.01,  // 법규 적중 (1%)
      education_hit: 0.01    // 교육 적중 (1%)
    },
    priority_keywords: {
      "끼임": 0.25,        // 끼임 사고 발견시 +25% 부스팅 (수차의 최대 위험)
      "회전체": 0.20,      // 회전체 키워드 발견시 +20% 부스팅
      "베어링": 0.15,      // 베어링 키워드 발견시 +15% 부스팅
      "진동": 0.15,        // 진동 키워드 발견시 +15% 부스팅
      "축정렬": 0.10,      // 축정렬 키워드 발견시 +10% 부스팅
      "윤활": 0.10         // 윤활 키워드 발견시 +10% 부스팅
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

  // 디버깅: 제외 키워드 필터링 확인
  const title = item.metadata?.title || '제목없음';
  
  if (ex.length && ex.some((k) => hay.includes(k))) {
    console.log(`❌ [EXCLUDE] "${title}" - 제외키워드 "${ex.find(k => hay.includes(k))}" 발견`);
    return false;
  }
  if (exAny.length && exAny.some((k) => hay.includes(k))) {
    console.log(`❌ [EXCLUDE_ANY] "${title}" - 제외키워드 "${exAny.find(k => hay.includes(k))}" 발견`);
    return false;
  }
  if (incAny.length && incAny.some((k) => hay.includes(k))) {
    const matchedKeyword = incAny.find(k => hay.includes(k));
    console.log(`✅ [INCLUDE] "${title}" - 포함키워드 "${matchedKeyword}" 발견`);
    return true;
  }
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
  }
): BuiltQueries {
  // 캐시된 토큰이 있으면 재사용, 없으면 새로 생성
  const { nameTokens, wtTokens, eqTags, riskTags } = cachedTokens || {
    nameTokens: tokenize(equipment?.name),
    wtTokens: tokenize(workType?.name),
    eqTags: (equipment?.tags ?? []).map((t) => t.toLowerCase()),
    riskTags: (equipment?.riskTags ?? []).map((t) => t.toLowerCase())
  };

  const baseKeywords = profile.keywords ?? [];

  // 기본 설비 + 작업 정보
  const baseContext = [...nameTokens, ...eqTags, ...wtTokens].filter(Boolean).join(" ").trim();

  // 위험요소별 개별 쿼리 생성
  const riskQueries: string[] = [];
  
  // equipment에 risk_factors 정보가 있는 경우에만 처리 (DB 실제 데이터에서 가져온 경우)
  const equipmentData = equipment as any;
  console.log(`[디버깅] equipmentData.riskFactors:`, equipmentData?.riskFactors);
  
  if (equipmentData?.riskFactors) {
    const riskFactors = equipmentData.riskFactors;
    console.log(`[디버깅] riskFactors 처리 시작:`, riskFactors);
    
    if (riskFactors.highVoltageDetail) {
      const detail = tokenize(riskFactors.highVoltageDetail).slice(0, 3).join(" ");
      if (detail) riskQueries.push(`${baseContext} ${detail}`);
    }
    
    if (riskFactors.highPressureDetail) {
      const detail = tokenize(riskFactors.highPressureDetail).slice(0, 3).join(" ");
      if (detail) riskQueries.push(`${baseContext} ${detail}`);
    }
    
    if (riskFactors.highTemperatureDetail) {
      const detail = tokenize(riskFactors.highTemperatureDetail).slice(0, 3).join(" ");
      if (detail) riskQueries.push(`${baseContext} ${detail}`);
    }
    
    if (riskFactors.heightDetail) {
      const detail = tokenize(riskFactors.heightDetail).slice(0, 3).join(" ");
      if (detail) riskQueries.push(`${baseContext} ${detail}`);
    }
    
    if (riskFactors.mechanicalDetail) {
      const detail = tokenize(riskFactors.mechanicalDetail).slice(0, 3).join(" ");
      if (detail) riskQueries.push(`${baseContext} ${detail}`);
    }
  }

  // 규정/교육/사고 쿼리 구성: 프로파일 기본 + 위험요소별 개별 쿼리
  const accidents = uniq([
    ...((profile.queries?.accidents ?? []).map((q) => `${q}`)),
    ...riskQueries.map(rq => `${rq} 사고`)
  ]);

  const regulation = uniq([
    ...((profile.queries?.regulation ?? []).map((q) => `${q}`)),
    ...riskQueries.map(rq => `${rq} 안전기준`)
  ]);

  const education = uniq([
    ...((profile.queries?.education ?? []).map((q) => `${q}`)),
    ...riskQueries.map(rq => `${rq} 안전교육`)
  ]);

  const all = uniq([...accidents, ...regulation, ...education]);

  console.log(`[쿼리 빌드] 프로파일: ${profile.id}`);
  console.log(`  baseContext: "${baseContext}"`);
  console.log(`  riskQueries 생성됨 (${riskQueries.length}개):`, riskQueries);
  console.log(`  사고쿼리 ${accidents.length}건:`, accidents.slice(0, 3));
  console.log(`  법규쿼리 ${regulation.length}건:`, regulation.slice(0, 3));
  console.log(`  교육쿼리 ${education.length}건:`, education.slice(0, 3));
  console.log(`  전체 법규쿼리:`, regulation);

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
  
  // 우선순위 키워드 부스팅 적용 (대소문자 구분 없이)
  let priorityBonus = 0;
  const debugKeywords: string[] = [];
  if (profile.priority_keywords) {
    const lowerText = text.toLowerCase();
    for (const [keyword, boost] of Object.entries(profile.priority_keywords)) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerText.includes(lowerKeyword)) {
        priorityBonus += boost;
        debugKeywords.push(`${keyword}(+${boost})`);
      }
    }
    if (debugKeywords.length > 0) {
      console.log(`⚡ 우선순위 키워드 매칭: [${debugKeywords.join(', ')}] 총 부스팅: +${priorityBonus.toFixed(3)}`);
    }
  }
  
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
  score += priorityBonus;  // 우선순위 키워드 부스팅 추가
  score -= penalty;

  return Math.max(0, Math.min(1, score));
}

// ------------------ Dynamic Safety Keyword Extraction ------------------

export function extractSafetyKeywordsFromWorkType(workTypeDescription: string): {
  primaryKeywords: string[];
  riskKeywords: string[];
  equipmentKeywords: string[];
  procedureKeywords: string[];
  priorityWeights: { [keyword: string]: number };
} {
  const text = workTypeDescription.toLowerCase();
  
  // 1. 위험/사고 관련 키워드 (높은 우선순위)
  const riskPatterns = [
    { pattern: /끼임|협착|말림|끼이/g, keywords: ["끼임", "협착"], weight: 0.30 },
    { pattern: /감전|전기.*사고|충전부|활선/g, keywords: ["감전", "충전부", "활선"], weight: 0.25 },
    { pattern: /추락|떨어짐|고소.*작업|추락방지/g, keywords: ["추락", "고소작업"], weight: 0.25 },
    { pattern: /화재|폭발|인화성|가연성/g, keywords: ["화재", "폭발"], weight: 0.23 },
    { pattern: /화학.*물질|독성|유해.*물질|중독/g, keywords: ["화학물질", "독성"], weight: 0.20 },
    { pattern: /질식|산소.*결핍|밀폐.*공간/g, keywords: ["질식", "밀폐공간"], weight: 0.20 },
    { pattern: /압력|고압|압축|압력용기/g, keywords: ["고압", "압력"], weight: 0.18 },
    { pattern: /온도|고온|화상|열상/g, keywords: ["고온", "화상"], weight: 0.15 },
    { pattern: /진동|소음|분진/g, keywords: ["진동", "소음", "분진"], weight: 0.12 }
  ];

  // 2. 설비/장비 관련 키워드 (중간 우선순위)
  const equipmentPatterns = [
    { pattern: /회전체|회전.*기계|터빈|모터/g, keywords: ["회전체", "터빈"], weight: 0.15 },
    { pattern: /크레인|호이스트|리프트|승강/g, keywords: ["크레인", "호이스트"], weight: 0.15 },
    { pattern: /배관|밸브|파이프|유압/g, keywords: ["배관", "밸브", "유압"], weight: 0.12 },
    { pattern: /전기.*설비|변압기|개폐기|gis/g, keywords: ["전기설비", "변압기", "개폐기"], weight: 0.12 },
    { pattern: /용접|절단|가스.*용접|아크.*용접/g, keywords: ["용접", "절단"], weight: 0.12 },
    { pattern: /컨베이어|벨트|이송.*장치/g, keywords: ["컨베이어", "벨트"], weight: 0.10 }
  ];

  // 3. 작업절차 관련 키워드 (기본 우선순위)
  const procedurePatterns = [
    { pattern: /점검|검사|정비|수리/g, keywords: ["점검", "정비"], weight: 0.10 },
    { pattern: /청소|세척|제거/g, keywords: ["청소", "세척"], weight: 0.08 },
    { pattern: /설치|해체|분해|조립/g, keywords: ["설치", "해체"], weight: 0.08 },
    { pattern: /운반|이동|운송/g, keywords: ["운반", "이동"], weight: 0.08 },
    { pattern: /측정|계측|감시|모니터링/g, keywords: ["측정", "감시"], weight: 0.06 }
  ];

  // 4. 보호구/안전조치 관련 키워드
  const safetyMeasurePatterns = [
    { pattern: /안전모|헬멧|보호구/g, keywords: ["안전모", "보호구"], weight: 0.12 },
    { pattern: /안전대|안전벨트|추락방지/g, keywords: ["안전대", "추락방지"], weight: 0.12 },
    { pattern: /절연.*장갑|절연.*신발|절연.*용품/g, keywords: ["절연장갑", "절연용품"], weight: 0.15 },
    { pattern: /호흡.*보호구|방독면|마스크/g, keywords: ["호흡보호구", "방독면"], weight: 0.12 },
    { pattern: /보호안경|안전안경|고글/g, keywords: ["보호안경", "안전안경"], weight: 0.08 }
  ];

  // 키워드 추출 및 가중치 계산
  const extractedKeywords = new Map<string, number>();
  const primaryKeywords: string[] = [];
  const riskKeywords: string[] = [];
  const equipmentKeywords: string[] = [];
  const procedureKeywords: string[] = [];

  // 위험 키워드 추출 (최고 우선순위)
  riskPatterns.forEach(({ pattern, keywords, weight }) => {
    if (pattern.test(text)) {
      keywords.forEach(keyword => {
        riskKeywords.push(keyword);
        primaryKeywords.push(keyword);
        extractedKeywords.set(keyword, Math.max(extractedKeywords.get(keyword) || 0, weight));
      });
    }
  });

  // 설비 키워드 추출
  equipmentPatterns.forEach(({ pattern, keywords, weight }) => {
    if (pattern.test(text)) {
      keywords.forEach(keyword => {
        equipmentKeywords.push(keyword);
        extractedKeywords.set(keyword, Math.max(extractedKeywords.get(keyword) || 0, weight));
      });
    }
  });

  // 작업절차 키워드 추출
  procedurePatterns.forEach(({ pattern, keywords, weight }) => {
    if (pattern.test(text)) {
      keywords.forEach(keyword => {
        procedureKeywords.push(keyword);
        extractedKeywords.set(keyword, Math.max(extractedKeywords.get(keyword) || 0, weight));
      });
    }
  });

  // 안전조치 키워드 추출
  safetyMeasurePatterns.forEach(({ pattern, keywords, weight }) => {
    if (pattern.test(text)) {
      keywords.forEach(keyword => {
        primaryKeywords.push(keyword);
        extractedKeywords.set(keyword, Math.max(extractedKeywords.get(keyword) || 0, weight));
      });
    }
  });

  const priorityWeights = Object.fromEntries(extractedKeywords);

  console.log(`[키워드 추출] 작업설명: "${workTypeDescription.substring(0, 50)}..."`);
  console.log(`[키워드 추출] 위험키워드: [${riskKeywords.join(', ')}]`);
  console.log(`[키워드 추출] 설비키워드: [${equipmentKeywords.join(', ')}]`);
  console.log(`[키워드 추출] 절차키워드: [${procedureKeywords.join(', ')}]`);
  console.log(`[키워드 추출] 우선순위 가중치:`, priorityWeights);

  return {
    primaryKeywords: Array.from(new Set(primaryKeywords)),
    riskKeywords: Array.from(new Set(riskKeywords)),
    equipmentKeywords: Array.from(new Set(equipmentKeywords)),
    procedureKeywords: Array.from(new Set(procedureKeywords)),
    priorityWeights
  };
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