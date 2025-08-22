// 수차 작업 설명에서 동적 키워드 추출 테스트
const workTypeDescription = `대청수력 제2호 수차발전기 대점검(배수)은 발전기 내부 및 부속설비를 정밀 점검하기 위해 취수문·드레인 밸브·방수문 조작, 배수펌프 운전, 잠수 및 수밀작업, Draft Tube 및 Spiral Casing 개방, 런너 점검 등으로 구성된 장기간·다단계 공정이다.
본 작업은 수력발전소의 핵심설비를 대상으로 진행되므로, 수압·밀폐공간·중량물 취급·잠수작업 등 다양한 위험요소가 내재되어 있다.`;

// 키워드 추출 함수 구현 (server/profiles.ts에서 복사)
function extractSafetyKeywordsFromWorkType(workTypeDescription) {
  const text = workTypeDescription.toLowerCase();
  
  // 1. 위험/사고 관련 키워드 (높은 우선순위)
  const riskPatterns = [
    { pattern: /끼임|협착|말림|끼이/g, keywords: ["끼임", "협착"], weight: 0.30 },
    { pattern: /감전|전기.*사고|충전부|활선/g, keywords: ["감전", "충전부", "활선"], weight: 0.25 },
    { pattern: /추락|떨어짐|고소.*작업|추락방지/g, keywords: ["추락", "고소작업"], weight: 0.25 },
    { pattern: /화재|폭발|인화성|가연성/g, keywords: ["화재", "폭발"], weight: 0.23 },
    { pattern: /화학.*물질|독성|유해.*물질|중독/g, keywords: ["화학물질", "독성"], weight: 0.20 },
    { pattern: /질식|산소.*결핍|밀폐.*공간/g, keywords: ["질식", "밀폐공간"], weight: 0.20 },
    { pattern: /압력|고압|압축|압력용기|수압/g, keywords: ["고압", "압력", "수압"], weight: 0.18 },
    { pattern: /온도|고온|화상|열상/g, keywords: ["고온", "화상"], weight: 0.15 },
    { pattern: /진동|소음|분진/g, keywords: ["진동", "소음", "분진"], weight: 0.12 }
  ];

  // 2. 설비/장비 관련 키워드 (중간 우선순위)
  const equipmentPatterns = [
    { pattern: /회전체|회전.*기계|터빈|모터|런너/g, keywords: ["회전체", "터빈", "런너"], weight: 0.15 },
    { pattern: /크레인|호이스트|리프트|승강/g, keywords: ["크레인", "호이스트"], weight: 0.15 },
    { pattern: /배관|밸브|파이프|유압|드레인.*밸브|방수문/g, keywords: ["배관", "밸브", "유압"], weight: 0.12 },
    { pattern: /전기.*설비|변압기|개폐기|gis|발전기/g, keywords: ["전기설비", "변압기", "개폐기", "발전기"], weight: 0.12 },
    { pattern: /용접|절단|가스.*용접|아크.*용접/g, keywords: ["용접", "절단"], weight: 0.12 },
    { pattern: /컨베이어|벨트|이송.*장치|펌프/g, keywords: ["컨베이어", "벨트", "펌프"], weight: 0.10 },
    { pattern: /중량물|무거운.*물체|중량.*취급/g, keywords: ["중량물"], weight: 0.18 }
  ];

  // 3. 작업절차 관련 키워드 (기본 우선순위)
  const procedurePatterns = [
    { pattern: /점검|검사|정비|수리/g, keywords: ["점검", "정비"], weight: 0.10 },
    { pattern: /청소|세척|제거/g, keywords: ["청소", "세척"], weight: 0.08 },
    { pattern: /설치|해체|분해|조립|개방/g, keywords: ["설치", "해체", "개방"], weight: 0.08 },
    { pattern: /운반|이동|운송/g, keywords: ["운반", "이동"], weight: 0.08 },
    { pattern: /측정|계측|감시|모니터링/g, keywords: ["측정", "감시"], weight: 0.06 },
    { pattern: /조작|운전|취급/g, keywords: ["조작", "운전"], weight: 0.08 },
    { pattern: /잠수.*작업|수밀.*작업|잠수/g, keywords: ["잠수작업", "수밀작업"], weight: 0.20 }
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
  const extractedKeywords = new Map();
  const primaryKeywords = [];
  const riskKeywords = [];
  const equipmentKeywords = [];
  const procedureKeywords = [];

  console.log(`\n🔍 [키워드 추출 테스트] 작업 설명:`);
  console.log(`"${workTypeDescription}"`);
  console.log(`\n텍스트 소문자: "${text}"`);

  // 위험 키워드 추출 (최고 우선순위)
  riskPatterns.forEach(({ pattern, keywords, weight }) => {
    if (pattern.test(text)) {
      console.log(`✅ 위험 패턴 매칭: ${pattern} → [${keywords.join(', ')}] (가중치: ${weight})`);
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
      console.log(`✅ 설비 패턴 매칭: ${pattern} → [${keywords.join(', ')}] (가중치: ${weight})`);
      keywords.forEach(keyword => {
        equipmentKeywords.push(keyword);
        extractedKeywords.set(keyword, Math.max(extractedKeywords.get(keyword) || 0, weight));
      });
    }
  });

  // 작업절차 키워드 추출
  procedurePatterns.forEach(({ pattern, keywords, weight }) => {
    if (pattern.test(text)) {
      console.log(`✅ 절차 패턴 매칭: ${pattern} → [${keywords.join(', ')}] (가중치: ${weight})`);
      keywords.forEach(keyword => {
        procedureKeywords.push(keyword);
        extractedKeywords.set(keyword, Math.max(extractedKeywords.get(keyword) || 0, weight));
      });
    }
  });

  // 안전조치 키워드 추출
  safetyMeasurePatterns.forEach(({ pattern, keywords, weight }) => {
    if (pattern.test(text)) {
      console.log(`✅ 안전조치 패턴 매칭: ${pattern} → [${keywords.join(', ')}] (가중치: ${weight})`);
      keywords.forEach(keyword => {
        primaryKeywords.push(keyword);
        extractedKeywords.set(keyword, Math.max(extractedKeywords.get(keyword) || 0, weight));
      });
    }
  });

  const priorityWeights = Object.fromEntries(extractedKeywords);

  console.log(`\n🎯 [최종 결과]`);
  console.log(`위험키워드 (${riskKeywords.length}개): [${riskKeywords.join(', ')}]`);
  console.log(`설비키워드 (${equipmentKeywords.length}개): [${equipmentKeywords.join(', ')}]`);
  console.log(`절차키워드 (${procedureKeywords.length}개): [${procedureKeywords.join(', ')}]`);
  console.log(`주요키워드 (${primaryKeywords.length}개): [${Array.from(new Set(primaryKeywords)).join(', ')}]`);
  console.log(`우선순위 가중치:`, priorityWeights);

  return {
    primaryKeywords: Array.from(new Set(primaryKeywords)),
    riskKeywords: Array.from(new Set(riskKeywords)),
    equipmentKeywords: Array.from(new Set(equipmentKeywords)),
    procedureKeywords: Array.from(new Set(procedureKeywords)),
    priorityWeights
  };
}

// 테스트 실행
const result = extractSafetyKeywordsFromWorkType(workTypeDescription);
console.log(`\n=== 수차 브리핑에서 추출된 동적 키워드 ===`);
console.log(`총 ${Object.keys(result.priorityWeights).length}개 키워드가 추출되어 우선순위 적용됨`);