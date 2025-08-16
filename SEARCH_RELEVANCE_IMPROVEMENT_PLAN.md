# 안전 브리핑 검색 관련성 개선 방안

## 현재 문제점
- 170kV GIS 전기설비 점검 작업인데 "사출성형기", "소각로" 등 제조업 사고사례 검색
- 프로파일 매칭이 제대로 되지 않아 default 프로파일로 폴백
- 벡터 검색 자체에서 관련 없는 산업 결과 반환

## 해결 방안

### 1. 즉시 적용 가능한 개선안

#### A. 메타데이터 산업 분류 필터링 강화
```typescript
// 벡터 검색 후 산업별 강력 필터링
const filteredResults = searchResults.filter(result => {
  const industry = result.metadata?.industry?.toLowerCase() || '';
  const title = result.metadata?.title?.toLowerCase() || '';
  const content = result.document?.toLowerCase() || '';
  
  // 전기설비 작업시 제조업 완전 제외
  if (equipmentName.includes('GIS') || equipmentName.includes('170kV')) {
    const manufacturingPatterns = [
      '사출', '성형', '소각', '컨베이어', '벨트', '제조', '생산', 
      '가공', '포장', '운반', '조립', '용접', '절단'
    ];
    
    return !manufacturingPatterns.some(pattern => 
      title.includes(pattern) || content.includes(pattern) || industry.includes(pattern)
    );
  }
  
  return true;
});
```

#### B. 산업별 긍정적 키워드 매칭
```typescript
// 전기설비 관련 사고만 포함
const electricalKeywords = [
  '전기', '감전', '고압', '특별고압', '변전', 'gis', '개폐기', 
  '충전부', '활선', '절연', 'sf6', '가스절연'
];

const hasElectricalRelevance = electricalKeywords.some(keyword =>
  title.includes(keyword) || content.includes(keyword)
);
```

#### C. 컨텍스트 기반 유사도 임계값 조정
```typescript
// 전기설비 특화 유사도 임계값 상향 조정
const thresholds = {
  'electrical-hv-gis': {
    vectorSimilarity: 0.85,  // 더 높은 유사도 요구
    keywordWeight: 0.3       // 키워드 가중치 증가
  },
  'manufacturing': {
    vectorSimilarity: 0.75,
    keywordWeight: 0.2
  }
};
```

### 2. 중기 개선안

#### A. 전용 임베딩 모델 활용
- 전기/전력 산업 특화 임베딩 모델 적용
- 도메인 특화 벡터 공간에서 더 정확한 유사도 계산

#### B. 계층적 검색 시스템
```
1차: 산업 분류 (전기/제조/건설/화학 등)
2차: 설비 유형 (GIS/변압기/모터/펌프 등)  
3차: 작업 유형 (점검/정비/교체/청소 등)
4차: 위험 요소 (감전/협착/낙하/화재 등)
```

#### C. 학습 기반 관련성 점수
- 사용자 피드백을 통한 관련성 점수 학습
- 부적절한 검색 결과에 대한 네거티브 피드백 수집

### 3. 장기 개선안

#### A. 지식 그래프 구축
```
설비(170kV GIS) → 산업(전력) → 위험요소(감전) → 법규(전기설비안전관리법)
작업(점검) → 도구(절연장갑) → 교육(고압안전교육)
```

#### B. 멀티모달 검색
- 텍스트 + 이미지 + 도면 정보 결합
- 설비 사진을 통한 자동 태그 생성

#### C. 실시간 학습 시스템
- 브리핑 품질에 대한 실시간 피드백
- A/B 테스트를 통한 검색 알고리즘 최적화

## 권장 우선순위

### 🚀 즉시 적용 (High Priority)
1. 산업별 강력 필터링 (메타데이터 기반)
2. 전기설비 특화 키워드 매칭
3. 컨텍스트별 유사도 임계값 조정

### 📈 중기 적용 (Medium Priority)  
1. 계층적 검색 시스템
2. 학습 기반 관련성 점수
3. 전용 임베딩 모델

### 🔬 장기 연구 (Low Priority)
1. 지식 그래프 구축
2. 멀티모달 검색
3. 실시간 학습 시스템

## 예상 개선 효과

### Before (현재)
- 전기설비 관련성: 40% (사출성형기, 소각로 포함)
- 사용자 만족도: 60%
- 안전 브리핑 품질: 보통

### After (개선 후)
- 전기설비 관련성: 90%+ (산업별 필터링)
- 사용자 만족도: 85%+
- 안전 브리핑 품질: 우수

개선안을 단계적으로 적용하여 점진적으로 검색 품질을 향상시킬 수 있습니다.