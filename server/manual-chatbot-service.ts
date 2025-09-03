import { LocalIndex } from 'vectra';
import { OpenAI } from 'openai';
import path from 'path';
import fs from 'fs/promises';
import MiniSearch from 'minisearch';

export interface ManualChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  equipment?: string[];
  sourceChunks?: ManualChunk[];
}

export interface ManualChunk {
  id: string;
  text: string;
  metadata: {
    doc_id: string;
    family: string;
    equipment: string[];
    page_start: number;
    page_end: number;
    section_path?: string;
    title?: string;
    collection: string;
    task_type?: string[];
    component?: string[];
  };
  score: number;
}

export interface ChatContext {
  sessionId: string;
  messages: ManualChatMessage[];
  selectedEquipment?: string[];
  selectedFamily?: string;
}

export class ManualChatbotService {
  private index: LocalIndex;
  private openai: OpenAI;
  private isInitialized = false;
  private readonly indexPath = './chatbot/codes/vectra-manuals';
  private miniSearch: MiniSearch;
  private documentsLoaded = false;

  // 안전장치 관련 동의어 정의
  private readonly safetyAliases = [
    // 한글 동의어
    "안전장치", "보호장치", "보호계전기", "인터록", "전기적 인터록", "기계적 인터록", 
    "차단장치", "안전핀", "압력계전기", "저압차단", "과전류", "과압", "경보", "경고", "주의",
    // 영문 동의어
    "safety device", "protection", "protective relay", "interlock", "mechanical interlock",
    "electrical interlock", "lock", "trip", "alarm", "warning", "low pressure lockout", 
    "pressure switch", "PRD", "pressure relief device", "relief valve"
  ];

  // 한글-영문 키워드 매핑
  private readonly koreanEnglishMapping: { [key: string]: string[] } = {
    '발전기': ['generator', 'dynamo'],
    '베어링': ['bearing'],
    '점검': ['inspection', 'check', 'maintenance'],
    '정밀점검': ['overhaul inspection', 'detailed inspection'],
    '주기점검': ['periodic inspection', 'routine inspection'],
    '정기점검': ['periodic maintenance', 'scheduled maintenance'],
    '교체': ['replacement', 'replace'],
    '수리': ['repair', 'fix'],
    '정비': ['maintenance', 'service'],
    '조립': ['assembly', 'assemble'],
    '분해': ['disassembly', 'dismantle'],
    '냉각': ['cooling', 'cooler'],
    '윤활': ['lubrication', 'lubricating'],
    '오일': ['oil'],
    '온도': ['temperature'],
    '압력': ['pressure'],
    '진동': ['vibration'],
    '소음': ['noise'],
    '수차': ['turbine'],
    '로터': ['rotor'],
    '스테이터': ['stator'],
    '브러시': ['brush'],
    '슬립링': ['slip ring'],
    '절연': ['insulation'],
    '권선': ['winding'],
    '코일': ['coil'],
    '자극': ['pole'],
    '여자': ['excitation'],
    '계전기': ['relay'],
    '차단기': ['breaker'],
    '스위치': ['switch']
  };

  constructor() {
    this.index = new LocalIndex(this.indexPath);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });
    
    // MiniSearch 초기화 - BM25 스파스 검색용
    this.miniSearch = new MiniSearch({
      fields: ['text', 'title', 'equipment', 'component', 'task_type'], // 검색할 필드들
      storeFields: ['id', 'text', 'metadata', 'score'], // 저장할 필드들
      searchOptions: {
        boost: { title: 2, equipment: 1.5, component: 1.2 }, // 필드별 가중치
        fuzzy: 0.2 // 퍼지 매칭
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('매뉴얼 챗봇 서비스 초기화 중...');

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다.');
      }

      // 통합 매뉴얼 임베딩 파일 확인
      const embeddingFile = './chatbot/codes/manual_chunks_all.ndjson';
      try {
        await fs.access(embeddingFile);
        console.log('통합 매뉴얼 임베딩 파일 발견:', embeddingFile);
      } catch {
        throw new Error(`통합 매뉴얼 임베딩 파일을 찾을 수 없습니다: ${embeddingFile}`);
      }

      // OpenAI 연결 테스트
      await this.openai.models.list();
      
      // MiniSearch 문서 로딩
      await this.loadDocumentsToMiniSearch();
      
      this.isInitialized = true;
      console.log('매뉴얼 챗봇 서비스 초기화 완료');
    } catch (error) {
      console.error('매뉴얼 챗봇 서비스 초기화 실패:', error);
      throw error;
    }
  }

  // 한글 질의를 영문으로 번역하는 함수
  private translateKoreanQuery(query: string): string {
    let translatedQuery = query;
    
    // 한글 키워드를 영문으로 치환
    Object.entries(this.koreanEnglishMapping).forEach(([korean, englishTerms]) => {
      const koreanRegex = new RegExp(korean, 'gi');
      if (koreanRegex.test(translatedQuery)) {
        // 첫 번째 영문 용어로 치환
        translatedQuery = translatedQuery.replace(koreanRegex, englishTerms[0]);
      }
    });
    
    return translatedQuery;
  }

  // 질의 확장 함수
  private expandQuery(query: string): string[] {
    const normalizedQuery = query.toLowerCase();
    const translatedQuery = this.translateKoreanQuery(query);
    
    // 원본 질의와 번역된 질의 모두 포함
    const expandedQueries = [query];
    
    // 번역된 질의가 원본과 다르면 추가
    if (translatedQuery !== query) {
      expandedQueries.push(translatedQuery);
    }
    
    // 한글-영문 키워드 매핑으로 추가 키워드 생성
    Object.entries(this.koreanEnglishMapping).forEach(([korean, englishTerms]) => {
      if (query.includes(korean)) {
        englishTerms.forEach(englishTerm => {
          expandedQueries.push(englishTerm);
        });
      }
    });
    
    // 안전 관련 키워드가 포함되어 있는지 확인
    const hasSafetyKeyword = /안전|safety|interlock|보호|계전|alarm|warning|trip|압력|차단|경보|경고|주의/i.test(query);
    
    if (hasSafetyKeyword) {
      // 안전장치 동의어들 추가
      expandedQueries.push(...this.safetyAliases);
    }
    
    return Array.from(new Set(expandedQueries));
  }

  // MiniSearch용 문서 로딩
  private async loadDocumentsToMiniSearch(): Promise<void> {
    if (this.documentsLoaded) return;

    try {
      const embeddingFile = './chatbot/codes/manual_chunks_all.ndjson';
      const fileContent = await fs.readFile(embeddingFile, 'utf-8');
      const lines = fileContent.trim().split('\n');
      
      const documents = [];
      
      for (const line of lines) {
        try {
          const chunk = JSON.parse(line);
          const metadata = chunk.metadata || {};
          
          documents.push({
            id: chunk.id || `chunk_${Date.now()}_${Math.random()}`,
            text: chunk.text || '',
            title: metadata.title || '',
            equipment: Array.isArray(metadata.equipment) ? metadata.equipment.join(' ') : '',
            component: Array.isArray(metadata.component) ? metadata.component.join(' ') : '',
            task_type: Array.isArray(metadata.task_type) ? metadata.task_type.join(' ') : '',
            metadata: metadata
          });
        } catch (error) {
          continue; // 파싱 오류 무시
        }
      }
      
      this.miniSearch.addAll(documents);
      this.documentsLoaded = true;
      console.log(`MiniSearch에 ${documents.length}개 문서 로딩 완료`);
    } catch (error) {
      console.error('MiniSearch 문서 로딩 실패:', error);
    }
  }

  // RRF(Reciprocal Rank Fusion) 점수 결합
  private combineScoresRRF(sparseResults: any[], denseResults: any[], k: number = 60): Map<string, number> {
    const combinedScores = new Map<string, number>();
    
    // 스파스 검색 결과 RRF 점수 계산
    sparseResults.forEach((result, index) => {
      const rrf = 1 / (k + index + 1);
      combinedScores.set(result.id, (combinedScores.get(result.id) || 0) + rrf);
    });
    
    // 덴스 검색 결과 RRF 점수 계산
    denseResults.forEach((result, index) => {
      const rrf = 1 / (k + index + 1);
      combinedScores.set(result.id, (combinedScores.get(result.id) || 0) + rrf);
    });
    
    return combinedScores;
  }

  // 안전 태그 가중치 적용
  private applySafetyBoost(chunk: any, boost: number = 0.2): number {
    const metadata = chunk.metadata || {};
    const text = chunk.text || '';
    const title = metadata.title || '';
    
    // hazards, safety 태그나 안전 관련 키워드가 포함된 경우 가중치 적용
    const safetyKeywords = /안전|safety|hazard|위험|보호|protection|경보|alarm|경고|warning|인터록|interlock/i;
    const hasHazardTag = Array.isArray(metadata.task_type) && metadata.task_type.some((tag: string) => 
      /hazard|safety|안전|위험/i.test(tag)
    );
    const hasSafetyContent = safetyKeywords.test(text) || safetyKeywords.test(title);
    
    return (hasHazardTag || hasSafetyContent) ? boost : 0;
  }

  async searchManualContent(query: string, equipmentFilter?: string[], familyFilter?: string, limit: number = 5): Promise<ManualChunk[]> {
    await this.initialize();

    try {
      // 디버깅 로그
      console.log(`🔍 매뉴얼 검색 - 쿼리: "${query}"`);
      console.log(`📦 설비 필터: ${equipmentFilter ? JSON.stringify(equipmentFilter) : 'null'}`);
      console.log(`🏭 패밀리 필터: ${familyFilter || 'null'}`);

      // 1. 질의 확장
      const expandedQueries = this.expandQuery(query);
      console.log(`질의 확장 결과: ${expandedQueries.length}개 쿼리`);

      // 2. 스파스 검색 (MiniSearch - BM25)
      const sparseResults = [];
      for (const expandedQuery of expandedQueries) {
        const results = this.miniSearch.search(expandedQuery);
        sparseResults.push(...results.slice(0, limit * 2));
      }
      
      // 스파스 결과 중복 제거 및 점수 정규화
      const uniqueSparseResults = Array.from(
        new Map(sparseResults.map(r => [r.id, r])).values()
      ).slice(0, limit * 2);

      // 3. 덴스 검색 (벡터 검색)
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      
      const queryVector = embeddingResponse.data[0].embedding;
      const embeddingFile = './chatbot/codes/manual_chunks_all.ndjson';
      const fileContent = await fs.readFile(embeddingFile, 'utf-8');
      const lines = fileContent.trim().split('\n');
      
      const denseResults: { chunk: any; score: number; id: string }[] = [];
      
      for (const line of lines) {
        try {
          const chunk = JSON.parse(line);
          if (!chunk.embedding || !Array.isArray(chunk.embedding)) continue;
          
          const score = this.cosineSimilarity(queryVector, chunk.embedding);
          denseResults.push({ 
            chunk, 
            score, 
            id: chunk.id || `chunk_${Date.now()}_${Math.random()}`
          });
        } catch (error) {
          continue;
        }
      }
      
      // 덴스 결과 정렬
      denseResults.sort((a, b) => b.score - a.score);
      const topDenseResults = denseResults.slice(0, limit * 2);

      // 4. RRF로 점수 결합
      const combinedScores = this.combineScoresRRF(
        uniqueSparseResults, 
        topDenseResults.map(r => ({ id: r.id, score: r.score }))
      );

      // 5. 결과 통합 및 안전 가중치 적용
      const allChunks = new Map();
      
      // 스파스 결과 추가
      uniqueSparseResults.forEach(result => {
        if (result.metadata) {
          allChunks.set(result.id, result);
        }
      });
      
      // 덴스 결과 추가
      topDenseResults.forEach(result => {
        if (!allChunks.has(result.id)) {
          allChunks.set(result.id, {
            id: result.id,
            text: result.chunk.text,
            metadata: result.chunk.metadata,
            score: result.score
          });
        }
      });

      // 6. 최종 점수 계산 및 정렬
      const finalResults = Array.from(allChunks.values()).map(chunk => {
        const rrfScore = combinedScores.get(chunk.id) || 0;
        const safetyBoost = this.applySafetyBoost(chunk);
        const finalScore = rrfScore + safetyBoost;
        
        return { ...chunk, finalScore };
      }).sort((a, b) => b.finalScore - a.finalScore);

      // 7. 필터링 및 변환
      const chunks: ManualChunk[] = [];
      
      for (const result of finalResults) {
        const metadata = result.metadata || {};
        
        // 설비 필터링 (임시로 완화)
        if (equipmentFilter && equipmentFilter.length > 0) {
          const hasMatchingEquipment = equipmentFilter.some(eq => {
            const equipmentArray = Array.isArray(metadata.equipment) ? metadata.equipment : [];
            // 부분 매칭도 허용
            return equipmentArray.some(equip => 
              equip?.toLowerCase().includes(eq.toLowerCase()) || 
              eq.toLowerCase().includes(equip?.toLowerCase() || '')
            );
          });
          if (!hasMatchingEquipment) continue;
        }

        // 패밀리 필터링 (임시로 완화)
        if (familyFilter && metadata.family) {
          const familyMatch = metadata.family.toLowerCase().includes(familyFilter.toLowerCase()) || 
                            familyFilter.toLowerCase().includes(metadata.family.toLowerCase());
          if (!familyMatch) continue;
        }

        chunks.push({
          id: result.id,
          text: result.text || '',
          metadata: {
            doc_id: metadata.doc_id || '',
            family: metadata.family || '',
            equipment: Array.isArray(metadata.equipment) ? metadata.equipment : [],
            page_start: metadata.page_start || 0,
            page_end: metadata.page_end || 0,
            section_path: metadata.section_path,
            title: metadata.title,
            collection: metadata.collection || '',
            task_type: Array.isArray(metadata.task_type) ? metadata.task_type : [],
            component: Array.isArray(metadata.component) ? metadata.component : []
          },
          score: result.finalScore
        });

        if (chunks.length >= limit) break;
      }

      console.log(`하이브리드 검색 완료: 스파스 ${uniqueSparseResults.length}개, 덴스 ${topDenseResults.length}개 → 최종 ${chunks.length}개`);
      
      // 결과가 없을 때 샘플 메타데이터 출력
      if (chunks.length === 0 && finalResults.length > 0) {
        console.log(`❌ 필터링 후 결과 없음. 샘플 메타데이터:`);
        finalResults.slice(0, 3).forEach((result, i) => {
          const metadata = result.metadata || {};
          console.log(`  [${i+1}] equipment: ${JSON.stringify(metadata.equipment)}, family: "${metadata.family}"`);
        });
      }
      
      return chunks;
    } catch (error) {
      console.error('매뉴얼 검색 실패:', error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  async generateResponse(query: string, context: ChatContext): Promise<ManualChatMessage> {
    await this.initialize();

    try {
      // 관련 매뉴얼 내용 검색
      const relevantChunks = await this.searchManualContent(
        query, 
        context.selectedEquipment, 
        context.selectedFamily,
        5
      );

      // 컨텍스트 구성
      const systemPrompt = `당신은 산업설비 매뉴얼 전문가입니다. 다음 매뉴얼 내용을 바탕으로 사용자의 질문에 정확하고 상세하게 답변해주세요.

매뉴얼 내용:
${relevantChunks.map((chunk, i) => 
  `[${i+1}] ${chunk.metadata.title || '제목 없음'} (${chunk.metadata.family} - ${chunk.metadata.equipment?.join(', ')})
페이지: ${chunk.metadata.page_start}-${chunk.metadata.page_end}
내용: ${chunk.text}
`).join('\n')}

답변 가이드라인:
1. 매뉴얼의 정확한 내용을 기반으로 답변하세요
2. 안전 관련 내용은 특히 강조해주세요
3. 구체적인 절차나 단계가 있다면 순서대로 설명해주세요
4. 페이지 번호나 섹션 정보를 참조로 제공해주세요
5. 확실하지 않은 내용은 매뉴얼 원문 확인을 권장하세요`;

      // 이전 대화 컨텍스트 구성
      const conversationHistory = context.messages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // OpenAI API 호출
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: query }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const responseContent = completion.choices[0]?.message?.content || '죄송합니다. 응답을 생성할 수 없습니다.';

      // 응답 메시지 생성
      const responseMessage: ManualChatMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        equipment: context.selectedEquipment,
        sourceChunks: relevantChunks
      };

      return responseMessage;

    } catch (error) {
      console.error('응답 생성 실패:', error);
      
      return {
        id: this.generateMessageId(),
        role: 'assistant',
        content: '죄송합니다. 현재 시스템에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date(),
        equipment: context.selectedEquipment,
        sourceChunks: []
      };
    }
  }

  async getAvailableEquipment(): Promise<{ family: string; equipment: string[] }[]> {
    await this.initialize();

    try {
      // 통합 매뉴얼 임베딩 파일에서 메타데이터 수집
      const embeddingFile = './chatbot/codes/manual_chunks_all.ndjson';
      const fileContent = await fs.readFile(embeddingFile, 'utf-8');
      const lines = fileContent.trim().split('\n');
      
      const equipmentMap = new Map<string, Set<string>>();
      
      for (const line of lines) {
        try {
          const chunk = JSON.parse(line);
          const metadata = chunk.metadata || {};
          
          if (typeof metadata.family === 'string' && Array.isArray(metadata.equipment)) {
            if (!equipmentMap.has(metadata.family)) {
              equipmentMap.set(metadata.family, new Set());
            }
            metadata.equipment.forEach((eq: string) => equipmentMap.get(metadata.family)!.add(eq));
          }
        } catch (error) {
          continue; // 파싱 오류 무시
        }
      }

      return Array.from(equipmentMap.entries()).map(([family, equipment]) => ({
        family,
        equipment: Array.from(equipment)
      }));
    } catch (error) {
      console.error('설비 목록 조회 실패:', error);
      return [];
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}