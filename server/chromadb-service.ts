import { LocalIndex } from 'vectra';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';

export interface SearchResult {
  document: string;
  metadata: any;
  distance: number;
}

export class ChromaDBService {
  private index: LocalIndex;
  private genai: GoogleGenAI;
  private isInitialized = false;

  constructor() {
    // Vectra LocalIndex (파일 기반 임베디드 모드)
    this.index = new LocalIndex('./data/vectra-index');
    
    // Google Gemini AI for embeddings
    this.genai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "",
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Vectra 임베디드 모드 초기화 중...');

      // 인덱스 생성 또는 로드
      if (!await this.index.isIndexCreated()) {
        console.log('새로운 Vectra 인덱스 생성 중...');
        await this.index.createIndex();
      }

      // Gemini API 테스트
      if (!process.env.GEMINI_API_KEY) {
        console.log('Gemini API 키가 없어 Vectra 초기화 중단');
        this.isInitialized = true;
        return;
      }

      try {
        console.log('Gemini API 임베딩 테스트 중...');
        await this.generateEmbedding('test');
        console.log('Gemini API 테스트 성공, 데이터 임베딩 진행');
        
        // 데이터 로드 및 임베딩
        await this.loadAndEmbedData();
        
      } catch (error: any) {
        console.log('Gemini API 오류, Vectra 임베딩 건너뜀:', error.message);
        this.isInitialized = true;
        return;
      }

      this.isInitialized = true;
      console.log('Vectra 초기화 완료');

    } catch (error) {
      console.error('Vectra 초기화 실패:', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.genai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
          task_type: "RETRIEVAL_DOCUMENT", // 문서 임베딩용
          output_dimensionality: 768 // 저장 공간 효율을 위해 768 차원 사용
        }
      });
      
      return response.embeddings || [];
    } catch (error: any) {
      console.error('Gemini 임베딩 생성 실패:', error);
      throw error;
    }
  }

  private async loadAndEmbedData(): Promise<void> {
    try {
      // 기존 데이터 확인
      const items = await this.index.listItems();
      if (items.length > 0) {
        console.log(`Vectra에 이미 ${items.length}개의 문서가 있습니다.`);
        return;
      }

      console.log('데이터 로드 및 임베딩 시작...');

      // 1. 사고사례 데이터 로드
      const accidentCasesPath = path.join(process.cwd(), 'data', 'accident_cases_for_rag.json');
      let accidentCases = [];
      try {
        const accidentData = await fs.readFile(accidentCasesPath, 'utf-8');
        accidentCases = JSON.parse(accidentData);
        console.log(`사고사례 ${accidentCases.length}건 로드`);
      } catch (error) {
        console.log('사고사례 데이터 파일을 찾을 수 없습니다.');
      }

      // 2. 교육자료 데이터 로드
      const educationDataPath = path.join(process.cwd(), 'data', 'education_data.json');
      let educationData = [];
      try {
        const eduData = await fs.readFile(educationDataPath, 'utf-8');
        educationData = JSON.parse(eduData);
        console.log(`교육자료 ${educationData.length}건 로드`);
      } catch (error) {
        console.log('교육자료 데이터 파일을 찾을 수 없습니다.');
      }

      // 3. 안전법규 데이터 로드
      const regulationsPath = path.join(process.cwd(), 'data', 'safety_regulations.json');
      let regulations = [];
      try {
        const regData = await fs.readFile(regulationsPath, 'utf-8');
        regulations = JSON.parse(regData);
        console.log(`안전법규 ${regulations.length}건 로드`);
      } catch (error) {
        console.log('안전법규 데이터 파일을 찾을 수 없습니다.');
      }

      // 4. 데이터 임베딩 및 저장
      let totalItems = 0;

      // 사고사례 처리
      for (let i = 0; i < accidentCases.length; i++) {
        const incident = accidentCases[i];
        const content = `${incident.title}\n${incident.summary}\n위험요소: ${incident.risk_keywords}\n예방대책: ${incident.prevention}`;
        
        const embedding = await this.generateEmbedding(content);
        
        await this.index.upsertItem({
          id: `incident_${i}`,
          vector: embedding,
          metadata: {
            type: 'incident',
            title: incident.title,
            date: incident.date,
            industry: incident.industry,
            work_type: incident.work_type,
            risk_keywords: incident.risk_keywords,
            content: content
          }
        });

        totalItems++;
        console.log(`사고사례 ${i + 1}/${accidentCases.length} 임베딩 완료`);
      }

      // 교육자료 처리
      for (let i = 0; i < educationData.length; i++) {
        const edu = educationData[i];
        const content = `${edu.title}\n${edu.content}\n카테고리: ${edu.category}`;
        
        const embedding = await this.generateEmbedding(content);
        
        await this.index.upsertItem({
          id: `education_${i}`,
          vector: embedding,
          metadata: {
            type: 'education',
            title: edu.title,
            category: edu.category,
            keywords: edu.keywords,
            content: content
          }
        });

        totalItems++;
        console.log(`교육자료 ${i + 1}/${educationData.length} 임베딩 완료`);
      }

      // 안전법규 처리
      for (let i = 0; i < regulations.length; i++) {
        const reg = regulations[i];
        const content = `${reg.title} (${reg.article_number})\n${reg.content}\n분류: ${reg.category}`;
        
        const embedding = await this.generateEmbedding(content);
        
        await this.index.upsertItem({
          id: `regulation_${i}`,
          vector: embedding,
          metadata: {
            type: 'regulation',
            title: reg.title,
            article_number: reg.article_number,
            category: reg.category,
            content: content
          }
        });

        totalItems++;
        console.log(`안전법규 ${i + 1}/${regulations.length} 임베딩 완료`);
      }

      console.log(`총 ${totalItems}개 문서를 Vectra에 저장 완료`);

    } catch (error) {
      console.error('데이터 로드 및 임베딩 실패:', error);
      throw error;
    }
  }

  // 검색용 쿼리 임베딩 생성 (별도 메서드)
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const response = await this.genai.models.embedContent({
        model: "gemini-embedding-001",
        contents: query,
        config: {
          task_type: "RETRIEVAL_QUERY", // 검색 쿼리용
          output_dimensionality: 768
        }
      });
      
      return response.embeddings || [];
    } catch (error: any) {
      console.error('Gemini 쿼리 임베딩 생성 실패:', error);
      throw error;
    }
  }

  async searchRelevantData(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Gemini API 할당량 문제가 있으면 빈 결과 반환
      if (!process.env.GEMINI_API_KEY) {
        return [];
      }

      // 쿼리 임베딩 생성 (검색용)
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // Vectra에서 검색
      const results = await this.index.queryItems(queryEmbedding, limit);

      // 결과 포맷팅
      const searchResults: SearchResult[] = results.map(result => ({
        document: result.item.metadata.content,
        metadata: result.item.metadata,
        distance: result.score
      }));

      console.log(`Vectra 검색 완료: ${searchResults.length}개 결과`);
      return searchResults;

    } catch (error: any) {
      console.log('Gemini API 오류로 Vectra 검색 실패:', error.message);
      return [];
    }
  }

  async getStats(): Promise<{ count: number; collections: string[] }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const items = await this.index.listItems();
      
      return {
        count: items.length,
        collections: ['vectra-safety-rag']
      };
    } catch (error) {
      console.error('Vectra 통계 조회 실패:', error);
      return { count: 0, collections: [] };
    }
  }
}

// 싱글톤 인스턴스 생성 (Vectra 기반)
export const chromaDBService = new ChromaDBService();