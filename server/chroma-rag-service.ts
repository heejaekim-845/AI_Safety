// ChromaDB를 사용한 고급 RAG 시스템 (ChromaDB 서버가 실행 중일 때만 활성화)
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

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
  private accidentData: AccidentCase[] = [];
  private educationData: EducationData[] = [];
  private regulationData: SafetyRegulation[] = [];
  private isInitialized = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Enhanced RAG Service 초기화 시작...');
      
      // JSON 파일들에서 데이터 로드
      await this.loadInitialData();
      
      this.isInitialized = true;
      console.log('Enhanced RAG Service 초기화 완료');
    } catch (error) {
      console.error('Enhanced RAG Service 초기화 실패:', error);
      this.isInitialized = true;
    }
  }

  private async loadInitialData(): Promise<void> {
    try {
      // 사고사례 데이터 로드
      const accidentDataPath = path.join(process.cwd(), 'data', 'accident_cases_for_rag.json');
      if (fs.existsSync(accidentDataPath)) {
        this.accidentData = JSON.parse(fs.readFileSync(accidentDataPath, 'utf-8'));
        console.log(`사고사례 ${this.accidentData.length}건 로드 완료`);
      }

      // 교육자료 데이터 로드
      const educationDataPath = path.join(process.cwd(), 'data', 'education_data.json');
      if (fs.existsSync(educationDataPath)) {
        this.educationData = JSON.parse(fs.readFileSync(educationDataPath, 'utf-8'));
        console.log(`교육자료 ${this.educationData.length}건 로드 완료`);
      }

      // 안전보건 법규 데이터 추가
      this.regulationData = [
        {
          title: "제3조(전도의 방지)",
          article_number: "제3조",
          content: "사업주는 근로자가 작업장에서 넘어지거나 미끄러지는 등의 위험이 없도록 작업장 바닥 등을 안전하고 청결한 상태로 유지하여야 한다.",
          category: "작업장 안전"
        },
        {
          title: "제13조(안전난간의 구조 및 설치요건)",
          article_number: "제13조",
          content: "사업주는 근로자의 추락 등의 위험을 방지하기 위하여 안전난간을 설치하는 경우 상부 난간대, 중간 난간대, 발끝막이판 및 난간기둥으로 구성할 것",
          category: "추락방지"
        },
        {
          title: "제14조(낙하물에 의한 위험의 방지)",
          article_number: "제14조",
          content: "사업주는 작업장의 바닥, 도로 및 통로 등에서 낙하물이 근로자에게 위험을 미칠 우려가 있는 경우 보호망을 설치하는 등 필요한 조치를 하여야 한다.",
          category: "낙하물 방지"
        },
        {
          title: "제8조(조도)",
          article_number: "제8조",
          content: "사업주는 근로자가 상시 작업하는 장소의 작업면 조도를 정밀작업 300럭스 이상, 보통작업 150럭스 이상으로 하여야 한다.",
          category: "작업환경"
        },
        {
          title: "제16조(위험물 등의 보관)",
          article_number: "제16조",
          content: "사업주는 규정된 위험물질을 작업장 외의 별도의 장소에 보관하여야 하며, 작업장 내부에는 작업에 필요한 양만 두어야 한다.",
          category: "위험물 관리"
        }
      ];

      console.log(`법규 ${this.regulationData.length}건 로드 완료`);

    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
    }
  }

  // Simplified RAG uses keyword-based search instead of embeddings
  // This method is kept for potential future ChromaDB integration

  async searchRelevantAccidents(workType: string, equipmentName: string, riskFactors: string[], limit: number = 3): Promise<AccidentCase[]> {
    await this.initialize();

    try {
      // 키워드 기반 검색으로 관련 사고사례 찾기
      const searchTerms = [
        workType.toLowerCase(),
        equipmentName.toLowerCase(),
        ...riskFactors.map(rf => rf.toLowerCase())
      ];

      const relevantAccidents = this.accidentData.filter(accident => {
        const searchText = `${accident.title} ${accident.work_type} ${accident.accident_type} ${accident.summary} ${accident.risk_keywords}`.toLowerCase();
        
        return searchTerms.some(term => 
          term && searchText.includes(term)
        );
      });

      // 관련도 점수 계산 (키워드 매칭 수 기준)
      const scoredAccidents = relevantAccidents.map(accident => {
        const searchText = `${accident.title} ${accident.work_type} ${accident.accident_type} ${accident.summary} ${accident.risk_keywords}`.toLowerCase();
        const score = searchTerms.filter(term => 
          term && searchText.includes(term)
        ).length;
        
        return { accident, score };
      });

      // 점수순으로 정렬하고 limit만큼 반환
      return scoredAccidents
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.accident);

    } catch (error) {
      console.error('사고사례 검색 실패:', error);
      return [];
    }
  }

  async searchSafetyRegulations(query: string, limit: number = 5): Promise<SafetyRegulation[]> {
    await this.initialize();

    try {
      const queryLower = query.toLowerCase();
      
      const relevantRegulations = this.regulationData.filter(regulation => {
        const searchText = `${regulation.title} ${regulation.content} ${regulation.category}`.toLowerCase();
        return searchText.includes(queryLower) || 
               queryLower.split(' ').some(term => term && searchText.includes(term));
      });

      return relevantRegulations.slice(0, limit);

    } catch (error) {
      console.error('법규 검색 실패:', error);
      return [];
    }
  }

  async searchEducationMaterials(query: string, limit: number = 3): Promise<EducationData[]> {
    await this.initialize();

    try {
      const queryLower = query.toLowerCase();
      
      const relevantEducation = this.educationData.filter(edu => {
        const searchText = `${edu.title} ${edu.keywords} ${edu.content} ${edu.type}`.toLowerCase();
        return searchText.includes(queryLower) || 
               queryLower.split(' ').some(term => term && searchText.includes(term));
      });

      return relevantEducation.slice(0, limit);

    } catch (error) {
      console.error('교육자료 검색 실패:', error);
      return [];
    }
  }

  private extractFromDocument(document: string, field: string): string {
    const lines = document.split('\n');
    const fieldLine = lines.find(line => line.startsWith(`${field}:`));
    return fieldLine ? fieldLine.substring(field.length + 1).trim() : '';
  }

  async getAccidentsByWorkType(workType: string, limit: number = 5): Promise<AccidentCase[]> {
    await this.initialize();

    try {
      const workTypeLower = workType.toLowerCase();
      
      const relevantAccidents = this.accidentData.filter(accident => {
        return accident.work_type.toLowerCase().includes(workTypeLower) ||
               accident.title.toLowerCase().includes(workTypeLower);
      });

      return relevantAccidents.slice(0, limit);

    } catch (error) {
      console.error('작업유형별 사고사례 검색 실패:', error);
      return [];
    }
  }
}

export const chromaRAGService = new ChromaRAGService();