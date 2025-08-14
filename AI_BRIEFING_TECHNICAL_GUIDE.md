# AI 안전 브리핑 생성 시스템 - 기술 구현 가이드

## 1. 시스템 아키텍처 개요

### 1.1 전체 플로우
```
사용자 요청 → 작업일정 조회 → 설비/작업 정보 수집 → 날씨 데이터 연동 → RAG 검색 → AI 분석 → 브리핑 생성 → 저장 및 반환
```

### 1.2 핵심 컴포넌트
- **AI Service** (`server/ai-service.ts`): 핵심 브리핑 생성 엔진
- **Vectra DB Service** (`server/chromadb-service.ts`): 벡터 검색 및 RAG 시스템
- **Simple RAG Service** (`server/simple-rag-service.ts`): XLSX 기반 추가 사고사례 검색
- **Weather Service** (`server/weather-service.ts`): 실시간 환경 정보 연동

---

## 2. RAG (Retrieval-Augmented Generation) 시스템

### 2.1 데이터 소스 구성
```javascript
// 총 8,661개 문서로 구성된 안전 지식베이스
{
  incidents: 1793,      // 실제 산업재해 사고사례
  education: 6503,      // KOSHA 포털 연계 교육자료
  regulations: 367      // 산업안전보건법 관련 규정
}
```

### 2.2 벡터 데이터베이스 - Vectra 구현
```typescript
// server/chromadb-service.ts
export class ChromaDBService {
  private index: LocalIndex;  // Vectra LocalIndex
  private openai: OpenAI;     // OpenAI 임베딩 생성
  private readonly indexPath = './data/vectra-index';
  private readonly checkpointPath = './data/embedding-checkpoint.json';

  constructor() {
    this.index = new LocalIndex(this.indexPath);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
}
```

### 2.3 임베딩 생성 과정
```typescript
async addDocument(document: string, metadata: any): Promise<void> {
  // 1. OpenAI text-embedding-ada-002 모델로 임베딩 생성
  const embeddingResponse = await this.openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: document,
    encoding_format: "float"
  });

  // 2. Vectra 인덱스에 저장
  await this.index.insertItem({
    vector: embeddingResponse.data[0].embedding,
    metadata: { ...metadata, document }
  });
}
```

### 2.4 체크포인트 시스템
```typescript
// 100개 문서마다 자동 백업 생성
if (itemsProcessed % 100 === 0) {
  await this.saveCheckpoint({
    timestamp: new Date().toISOString(),
    phase: currentPhase,
    lastCompletedIndex: itemsProcessed,
    totalCount: totalItems,
    totalItemsProcessed: itemsProcessed,
    dataHashes: this.calculateDataHashes()
  });
}
```

---

## 3. 지능형 검색 시스템

### 3.1 설비별 특화 검색 쿼리 생성
```typescript
// 170kV GIS 설비의 경우
if (equipmentInfo.name.includes('kV') && equipmentInfo.name.includes('GIS')) {
  searchQueries = [
    `${equipmentInfo.name} 감전 사고`,
    '가스절연개폐장치 GIS 감전',
    '특별고압 170kV 충전부 접촉',
    '변전소 개폐기 조작 감전'
  ];
  regulationQueries = [
    '제323조 절연용 보호구 착용',
    '제319조 정전전로 작업',
    '제320조 정전전로 인근 전기작업'
  ];
}
```

### 3.2 하이브리드 스코어링 알고리즘
```typescript
private applyHybridScoring(results: any[], keywordWeights: { [key: string]: number }): any[] {
  const scoredResults = results.map(result => {
    // 1. 벡터 유사도 점수 (0-1)
    const vectorScore = Math.max(0, 1 - result.distance);
    
    // 2. 키워드 매칭 점수
    let keywordScore = 0;
    Object.entries(keywordWeights).forEach(([keyword, weight]) => {
      if (searchText.includes(keyword.toLowerCase())) {
        keywordScore += weight;
      }
    });
    
    // 3. 하이브리드 점수 계산
    const hybridScore = (vectorScore * 0.6) + (keywordScore * 0.4);
    
    return { ...result, hybridScore, vectorScore, keywordScore };
  });
  
  // 4. 임계값 필터링 (0.05 이상만 선택)
  return scoredResults.filter(r => r.hybridScore > 0.05);
}
```

### 3.3 설비별 키워드 가중치 시스템
```typescript
private getEquipmentKeywords(equipmentName: string): { [key: string]: number } {
  if (equipmentName.includes('170kV') && equipmentName.includes('GIS')) {
    return {
      '170kV': 10,           // 최고 가중치
      'GIS': 8,
      '가스절연개폐장치': 8,
      '특별고압': 8,
      '충전부': 6,
      '절연': 5,
      '감전': 6,
      '교육': 3,
      '안전교육': 4,
      '보호구': 4,
      '절연장갑': 5
    };
  }
  return {};
}
```

---

## 4. AI 모델 통합 시스템

### 4.1 다중 AI 모델 활용
```typescript
// 1. OpenAI GPT-4o: 임베딩 생성
const embeddingResponse = await this.openai.embeddings.create({
  model: "text-embedding-ada-002",
  input: document
});

// 2. Google Gemini 2.5 Flash: 브리핑 생성
const response = await genai.models.generateContent({
  model: "gemini-2.5-flash",
  config: {
    systemInstruction: "산업안전 전문가로서 종합적 안전 브리핑을 생성합니다.",
    responseMimeType: "application/json",
    temperature: 0.3
  },
  contents: prompt
});
```

### 4.2 구조화된 프롬프트 시스템
```typescript
const safetyBriefingPrompt = `
다음 산업설비 작업에 대한 종합적인 안전 브리핑을 생성해주세요.

## 설비 정보
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 주요 위험요소: ${this.formatRisks(equipmentInfo)}

## 작업 정보
- 작업명: ${workType.name}
- 예상 소요시간: ${workType.estimatedDuration}분

## 환경 조건
${weatherData ? `
- 날씨: ${weatherData.condition}
- 온도: ${weatherData.temperature}°C
- 습도: ${weatherData.humidity}%
` : ''}

## RAG 검색 결과
### 관련 사고사례 (${chromaAccidents.length}건)
${chromaAccidents.map(acc => `- ${acc.metadata.title}: ${acc.document.substring(0, 200)}`).join('\n')}

### 교육자료 (${educationMaterials.length}건)
${educationMaterials.map(edu => `- ${edu.metadata.title}`).join('\n')}

### 안전규정 (${safetyRegulations.length}건)
${safetyRegulations.map(reg => `- ${reg.summary}`).join('\n')}

응답 형식: JSON
{
  "workSummary": "작업 요약",
  "riskFactors": ["위험요소1", "위험요소2"],
  "riskAssessment": {
    "totalScore": 점수,
    "riskFactors": [{
      "factor": "위험요소",
      "probability": 1-5,
      "severity": 1-4,
      "score": "probability × severity"
    }]
  },
  "requiredTools": [{"name": "도구명", "source": "ai_recommended"}],
  "requiredSafetyEquipment": [{"name": "보호구명", "source": "ai_recommended"}],
  "weatherConsiderations": ["날씨 고려사항"],
  "safetyRecommendations": ["안전 권고사항"],
  "quizQuestions": [{
    "question": "질문",
    "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
    "correctAnswer": 정답번호,
    "explanation": "해설"
  }],
  "safetySlogan": "안전 슬로건"
}`;
```

---

## 5. 성능 최적화 시스템

### 5.1 한국어 기반 타이밍 분석
```typescript
async function timeit<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`[AIService][timing] ${operation}: ${duration.toFixed(1)}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`[AIService][timing] ${operation} 실패: ${duration.toFixed(1)}ms`);
    throw error;
  }
}
```

### 5.2 병렬 처리 최적화
```typescript
// 다중 쿼리 병렬 검색
const chromaResults = await timeit(
  `chroma.search parallel ${searchQueries.length}q`,
  async () => {
    const searchPromises = searchQueries.map(query => 
      this.chromaDBService.search(query, 15)
    );
    return await Promise.all(searchPromises);
  }
);
```

### 5.3 캐시 시스템
```typescript
// 법령 요약 캐시 (동일한 법령은 재계산하지 않음)
private regulationSummaryCache = new Map<string, string>();

async summarizeRegulationCached(regulation: any): Promise<string> {
  const cacheKey = regulation.metadata?.title || regulation.document.substring(0, 100);
  
  if (this.regulationSummaryCache.has(cacheKey)) {
    return this.regulationSummaryCache.get(cacheKey)!;
  }
  
  const summary = await this.summarizeRegulation(regulation);
  this.regulationSummaryCache.set(cacheKey, summary);
  return summary;
}
```

---

## 6. 실시간 환경 연동

### 6.1 날씨 API 통합
```typescript
// server/weather-service.ts
export class WeatherService {
  async getWeatherForLocation(location: string): Promise<WeatherInfo> {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: location,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric',
          lang: 'kr'
        }
      }
    );
    
    return this.mapWeatherData(response.data);
  }
}
```

### 6.2 날씨 기반 안전 경고 생성
```typescript
generateWeatherSafetyWarnings(weather: WeatherInfo): string[] {
  const warnings: string[] = [];
  
  if (weather.condition.includes('비') || weather.condition.includes('rain')) {
    warnings.push("미끄럼 위험 - 논슬립 안전화 착용 필수");
    warnings.push("전기 작업 시 특별 주의 - 절연 보호구 사용");
  }
  
  if (weather.humidity > 80) {
    warnings.push("고습도 환경 - 통풍 확보 및 탈수 주의");
  }
  
  if (weather.windSpeed > 10) {
    warnings.push("강풍 주의 - 고소작업 및 크레인 작업 제한");
  }
  
  return warnings;
}
```

---

## 7. 브리핑 생성 프로세스

### 7.1 단계별 실행 과정
```typescript
async generateEnhancedSafetyBriefing(): Promise<any> {
  return await timeit("generateEnhancedSafetyBriefing TOTAL", async () => {
    
    // 1단계: RAG 데이터 검색 (1-2초)
    const ragResults = await this.performRAGSearch(equipmentInfo, workType);
    
    // 2단계: 추가 사고사례 검색 (0.1초)
    const additionalAccidents = await this.simpleRAGService.searchRelevantAccidents(
      equipmentInfo.name, workType.name
    );
    
    // 3단계: AI 브리핑 생성 (20-25초)
    const aiAnalysis = await timeit(
      "gemini.generateContent(briefing)",
      async () => await this.generateAIBriefing(prompt)
    );
    
    // 4단계: 후처리 및 데이터 정리 (0.1초)
    return this.processBriefingResults(aiAnalysis, ragResults);
  });
}
```

### 7.2 성능 메트릭스
```
전체 브리핑 생성 시간: ~30초
├── RAG 벡터 검색: 315-525ms (1.5%)
├── 교육자료 URL 매칭: 28-37ms (0.1%)
├── 법령 요약: 8초 (캐시 미스 시)
├── AI 브리핑 생성: 18-27초 (85%)
└── 후처리: 100ms (0.3%)
```

---

## 8. 데이터 보호 및 안정성

### 8.1 자동 백업 시스템
```typescript
// 100개 문서마다 체크포인트 생성
async saveCheckpoint(checkpoint: EmbeddingCheckpoint): Promise<void> {
  // 1. 메인 체크포인트 저장
  await fs.writeFile(
    this.checkpointPath, 
    JSON.stringify(checkpoint, null, 2)
  );
  
  // 2. 백업 디렉토리에 타임스탬프 백업
  const backupDir = path.join(this.backupPath, checkpoint.timestamp);
  await fs.mkdir(backupDir, { recursive: true });
  
  // 3. 벡터 인덱스 백업
  await this.copyDirectory(this.indexPath, path.join(backupDir, 'vectra-index'));
}
```

### 8.2 오류 복구 메커니즘
```typescript
async initializeWithRecovery(): Promise<void> {
  try {
    await this.index.beginUpdate();
  } catch (error) {
    console.warn('Vectra 인덱스 손상 감지, 백업에서 복구 시도...');
    
    // 최신 백업에서 복구
    const latestBackup = await this.findLatestBackup();
    if (latestBackup) {
      await this.restoreFromBackup(latestBackup);
    } else {
      await this.rebuildFromScratch();
    }
  }
}
```

---

## 9. API 엔드포인트 구현

### 9.1 브리핑 생성 API
```typescript
// POST /api/generate-safety-briefing/:workScheduleId
app.post("/api/generate-safety-briefing/:workScheduleId", async (req, res) => {
  try {
    const workScheduleId = parseInt(req.params.workScheduleId);
    
    // 1. 작업 일정 조회
    const workSchedule = await storage.getWorkScheduleById(workScheduleId);
    
    // 2. 관련 데이터 수집
    const equipment = await storage.getEquipmentById(workSchedule.equipmentId);
    const workType = await storage.getWorkTypeById(workSchedule.workTypeId);
    
    // 3. 날씨 정보 조회
    const weatherInfo = await weatherService.getWeatherForLocation(
      workSchedule.workLocation || equipment.location
    );
    
    // 4. AI 브리핑 생성
    const aiAnalysis = await aiService.generateEnhancedSafetyBriefing(
      equipment, workType, weatherInfo, workSchedule.specialNotes
    );
    
    // 5. 데이터베이스 저장
    const briefing = await storage.createSafetyBriefing(briefingData);
    
    res.json({ briefing, ...aiAnalysis });
    
  } catch (error) {
    res.status(500).json({ message: "브리핑 생성 실패" });
  }
});
```

---

## 10. 확장성 및 유지보수

### 10.1 모듈화된 아키텍처
```
server/
├── ai-service.ts           # 핵심 AI 브리핑 엔진
├── chromadb-service.ts     # Vectra 벡터 DB 서비스
├── simple-rag-service.ts   # 추가 RAG 검색
├── weather-service.ts      # 날씨 데이터 연동
├── rag-service.ts         # 레거시 RAG (주석 처리됨)
└── routes.ts              # API 라우터
```

### 10.2 설정 기반 튜닝
```typescript
// 하이브리드 스코어링 임계값 (성능 최적화 결과)
const EDUCATION_THRESHOLD = 0.05;  // 교육자료 임계값
const INCIDENT_THRESHOLD = 0.05;   // 사고사례 임계값

// 벡터 검색 결과 수 제한
const MAX_SEARCH_RESULTS = 15;     // 각 쿼리당 최대 결과
const MAX_FINAL_RESULTS = 5;       // 최종 선택 결과
```

### 10.3 로깅 및 모니터링
```typescript
// 상세 성능 로깅
console.log(`[applyHybridScoring] 임계값: ${threshold}, 타입: ${type}`);
console.log(`[applyHybridScoring] 필터링 전 결과: ${sorted.length}개`);
console.log(`[applyHybridScoring] 필터링 후 결과: ${filtered.length}개`);

// RAG 검색 결과 추적
console.log(`RAG 검색 완료: 사고사례 ${incidents.length}건, 교육자료 ${education.length}건, 법규 ${regulations.length}건`);
```

---

## 11. 결론

이 AI 안전 브리핑 시스템은 다음과 같은 기술적 혁신을 구현했습니다:

1. **하이브리드 RAG 시스템**: 벡터 유사도와 키워드 매칭을 결합한 정밀 검색
2. **다중 AI 모델 활용**: OpenAI와 Google Gemini의 장점을 결합
3. **실시간 환경 연동**: 날씨 데이터를 활용한 동적 안전 평가
4. **설비별 특화 검색**: 전기설비, 압축기 등 설비 특성별 맞춤 검색
5. **성능 최적화**: 30초 이내 종합 브리핑 생성 보장
6. **데이터 안정성**: 자동 백업 및 복구 시스템

전체 시스템은 산업현장의 실제 요구사항을 반영하여 설계되었으며, 8,661개의 실제 안전 데이터를 기반으로 신뢰성 있는 안전 브리핑을 제공합니다.