// ChromaDB를 사용한 고급 RAG 시스템 (벡터 데이터베이스 기반)
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
// ChromaDB import 제거 - 벡터 DB는 ai-service.ts에서 처리

interface AccidentCase {
  title: string;
  date: string;
  location: string;
  industry: string;
  work_type: string;
  accident_type: string;
  damage: string;
  summary: string;
  direct_cause: string;
  root_cause: string;
  risk_keywords: string;
  prevention: string;
}

interface EducationData {
  title: string;
  date: string;
  doc_number: string;
  type: string;
  keywords: string;
  content: string;
  url: string;
  file_url: string;
}

interface SafetyRegulation {
  title: string;
  article_number: string;
  content: string;
  category: string;
}

export class ChromaRAGService {
  private openai: OpenAI;
  private chromaClient: any; // ChromaDB 제거됨
  private accidentData: AccidentCase[] = [];
  private educationData: EducationData[] = [];
  private regulationData: SafetyRegulation[] = [];
  private isInitialized = false;
  private vectorCollections: {
    accidents?: any;
    education?: any;
    regulations?: any;
  } = {};

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // ChromaDB 클라이언트 초기화 (완전 비활성화 모드)
    // ChromaDB 연결 오류 방지를 위해 null로 설정
    this.chromaClient = null as any;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('ChromaDB RAG Service 초기화 시작...');
      
      // JSON 파일들에서 데이터 로드
      await this.loadInitialData();
      
      // ChromaDB 벡터 컬렉션 초기화
      await this.initializeVectorCollections();
      
      this.isInitialized = true;
      console.log('ChromaDB RAG Service 초기화 완료');
    } catch (error) {
      console.error('ChromaDB RAG Service 초기화 실패, 키워드 기반으로 폴백:', error);
      this.isInitialized = true; // 키워드 기반 검색으로 폴백
    }
  }

  private async initializeVectorCollections(): Promise<void> {
    // ChromaDB 비활성화 - 키워드 기반 검색만 사용
    console.log('ChromaDB 비활성화됨, 키워드 기반 검색 사용');
    return;
  }

  private async populateVectorCollections(): Promise<void> {
    try {
      // 사고사례 벡터화
      if (this.accidentData.length > 0 && this.vectorCollections.accidents) {
        const accidentCount = await this.vectorCollections.accidents.count();
        if (accidentCount === 0) {
          const accidentTexts = this.accidentData.map(item => 
            `${item.title} ${item.work_type} ${item.accident_type} ${item.summary} ${item.direct_cause} ${item.risk_keywords}`
          );
          
          await this.vectorCollections.accidents.add({
            ids: this.accidentData.map((_, index) => `accident_${index}`),
            documents: accidentTexts,
            metadatas: this.accidentData.map(item => ({
              type: 'accident',
              work_type: item.work_type,
              accident_type: item.accident_type,
              date: item.date,
              location: item.location
            }))
          });
          console.log(`사고사례 ${this.accidentData.length}건 벡터화 완료`);
        }
      }

      // 교육자료 벡터화
      if (this.educationData.length > 0 && this.vectorCollections.education) {
        const educationCount = await this.vectorCollections.education.count();
        if (educationCount === 0) {
          const educationTexts = this.educationData.map(item => 
            `${item.title} ${item.type} ${item.keywords} ${item.content}`
          );
          
          await this.vectorCollections.education.add({
            ids: this.educationData.map((_, index) => `education_${index}`),
            documents: educationTexts,
            metadatas: this.educationData.map(item => ({
              type: 'education',
              doc_type: item.type,
              date: item.date,
              doc_number: item.doc_number
            }))
          });
          console.log(`교육자료 ${this.educationData.length}건 벡터화 완료`);
        }
      }

      // 법규 벡터화
      if (this.regulationData.length > 0 && this.vectorCollections.regulations) {
        const regulationCount = await this.vectorCollections.regulations.count();
        if (regulationCount === 0) {
          const regulationTexts = this.regulationData.map(item => 
            `${item.title} ${item.content} ${item.category}`
          );
          
          await this.vectorCollections.regulations.add({
            ids: this.regulationData.map((_, index) => `regulation_${index}`),
            documents: regulationTexts,
            metadatas: this.regulationData.map(item => ({
              type: 'regulation',
              article_number: item.article_number,
              category: item.category
            }))
          });
          console.log(`법규 ${this.regulationData.length}건 벡터화 완료`);
        }
      }
    } catch (error) {
      console.error('벡터 컬렉션 데이터 입력 실패:', error);
      throw error;
    }
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('임베딩 생성 실패:', error);
      throw error;
    }
  }

  private async loadInitialData(): Promise<void> {
    // 모든 데이터는 벡터 DB(vectra-index)에서 관리됨
    // JSON 파일 로드는 더 이상 필요하지 않음
    this.accidentData = [];
    this.educationData = [];
    this.regulationData = [];
    console.log('모든 데이터는 벡터 DB에서 검색됩니다');
  }

  // Simplified RAG uses keyword-based search instead of embeddings
  // This method is kept for potential future ChromaDB integration

  async searchRelevantAccidents(workType: string, equipmentName: string, riskFactors: string[], limit: number = 3): Promise<AccidentCase[]> {
    console.log('사고사례 검색은 벡터 DB에서 처리됩니다');
    return [];
  }

  async searchSafetyRegulations(equipmentName: string, workType: string, riskFactors: string[] = [], limit: number = 5): Promise<SafetyRegulation[]> {
    console.log('법규 검색은 벡터 DB에서 처리됩니다');
    return [];
  }

  async searchEducationMaterials(query: string, limit: number = 3): Promise<EducationData[]> {
    console.log('교육자료 검색은 벡터 DB에서 처리됩니다');
    return [];
  }

  private extractFromDocument(document: string, field: string): string {
    const lines = document.split('\n');
    const fieldLine = lines.find(line => line.startsWith(`${field}:`));
    return fieldLine ? fieldLine.substring(field.length + 1).trim() : '';
  }

  async getAccidentsByWorkType(workType: string, limit: number = 5): Promise<AccidentCase[]> {
    console.log('작업유형별 사고사례 검색은 벡터 DB(ai-service.ts)에서 처리됩니다');
    return [];
  }

  // ChromaDB 벡터 검색 메서드 (새로 추가)
  async searchRelevantDataVector(equipment: string, workType: string, riskLevel: string): Promise<{
    regulations: SafetyRegulation[];
    incidents: AccidentCase[];
    education: EducationData[];
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // ChromaDB 비활성화 - 직접 키워드 기반 검색 사용
    console.log('키워드 기반 검색 시작 (ChromaDB 비활성화)...');
    return await this.performKeywordSearch(equipment, workType, riskLevel);
  }

  private async performVectorSearch(searchQuery: string): Promise<{
    regulations: SafetyRegulation[];
    incidents: AccidentCase[];
    education: EducationData[];
  }> {
    try {
      // 각 컬렉션에서 유사한 문서 검색 (임베딩은 자동 생성됨)
      const [regulationResults, incidentResults, educationResults] = await Promise.all([
        this.vectorCollections.regulations!.query({
          queryTexts: [searchQuery],
          nResults: 3
        }),
        this.vectorCollections.accidents!.query({
          queryTexts: [searchQuery],
          nResults: 3
        }),
        this.vectorCollections.education!.query({
          queryTexts: [searchQuery],
          nResults: 2
        })
      ]);

      // 결과를 원본 데이터와 매핑
      const regulations = this.mapRegulationResults(regulationResults);
      const incidents = this.mapIncidentResults(incidentResults);
      const education = this.mapEducationResults(educationResults);

      console.log(`ChromaDB 벡터 검색 결과: 사고사례 ${incidents.length}건, 교육자료 ${education.length}건, 법규 ${regulations.length}건`);

      return { regulations, incidents, education };
      
    } catch (error) {
      console.error('벡터 검색 실행 실패:', error);
      throw error;
    }
  }

  private async performKeywordSearch(equipment: string, workType: string, riskLevel: string): Promise<{
    regulations: SafetyRegulation[];
    incidents: AccidentCase[];
    education: EducationData[];
  }> {
    console.log('🎯 키워드 검색 호출됨 - 빈 결과 반환 중');
    console.log(`🎯 검색 파라미터: equipment="${equipment}", workType="${workType}", riskLevel="${riskLevel}"`);
    console.log('🎯 반환값: regulations=0건, incidents=0건, education=0건');
    
    return {
      regulations: [],
      incidents: [],
      education: []
    };
  }

  private mapRegulationResults(results: any): SafetyRegulation[] {
    if (!results.ids || !results.ids[0]) return [];
    
    return results.ids[0].map((id: string) => {
      const index = parseInt(id.replace('regulation_', ''));
      return this.regulationData[index];
    }).filter(Boolean);
  }

  private mapIncidentResults(results: any): AccidentCase[] {
    if (!results.ids || !results.ids[0]) return [];
    
    return results.ids[0].map((id: string) => {
      const index = parseInt(id.replace('accident_', ''));
      return this.accidentData[index];
    }).filter(Boolean);
  }

  private mapEducationResults(results: any): EducationData[] {
    if (!results.ids || !results.ids[0]) return [];
    
    return results.ids[0].map((id: string) => {
      const index = parseInt(id.replace('education_', ''));
      return this.educationData[index];
    }).filter(Boolean);
  }
}

export const chromaRAGService = new ChromaRAGService();