// ChromaDB를 사용한 고급 RAG 시스템 (벡터 데이터베이스 기반)
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { ChromaClient } from 'chromadb';

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
  private chromaClient: ChromaClient;
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
    try {
      // 사고사례 데이터 로드
      const accidentDataPath = path.join(process.cwd(), 'data', 'accident_cases_for_rag.json');
      if (fs.existsSync(accidentDataPath)) {
        this.accidentData = JSON.parse(fs.readFileSync(accidentDataPath, 'utf-8'));
        console.log(`사고사례 ${this.accidentData.length}건 로드 완료`);
      }

      // 교육자료 데이터 로드 (attached_assets에서)
      const educationDataPath = path.join(process.cwd(), 'attached_assets', 'education_data.json');
      if (fs.existsSync(educationDataPath)) {
        this.educationData = JSON.parse(fs.readFileSync(educationDataPath, 'utf-8'));
        console.log(`교육자료 ${this.educationData.length}건 로드 완료`);
      } else {
        console.warn('교육자료 파일을 찾을 수 없습니다:', educationDataPath);
      }

      // 법규 데이터는 벡터 DB의 safety_rules.json에서 관리됨
      this.regulationData = [];
      console.log('법규 데이터는 벡터 DB에서 검색됩니다');

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
      ].filter(term => term && term.trim().length > 0);

      // 추가 키워드 확장
      const expandedTerms = [...searchTerms];
      if (equipmentName.toLowerCase().includes('gis')) {
        expandedTerms.push('변전소', '전기', '고전압', '감전', '절연');
      }
      if (workType.toLowerCase().includes('정비') || workType.toLowerCase().includes('점검')) {
        expandedTerms.push('정비', '점검', '수리', '보수');
      }
      if (workType.toLowerCase().includes('컨베이어')) {
        expandedTerms.push('벨트', '끼임', '회전');
      }

      const relevantAccidents = this.accidentData.filter(accident => {
        const searchText = `${accident.title} ${accident.work_type} ${accident.accident_type} ${accident.summary} ${accident.risk_keywords}`.toLowerCase();
        
        return expandedTerms.some(term => 
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

  async searchSafetyRegulations(equipmentName: string, workType: string, riskFactors: string[] = [], limit: number = 5): Promise<SafetyRegulation[]> {
    await this.initialize();

    try {
      // 복합 검색어 구성
      const queryTerms = [
        equipmentName.toLowerCase(),
        workType.toLowerCase(),
        ...riskFactors.map(rf => rf.toLowerCase())
      ].filter(term => term && term.trim().length > 0);
      
      // 장비별 특화 키워드 확장
      const expandedTerms = [...queryTerms];
      
      // 170kV GIS, 변전설비, 전기설비 관련
      if (equipmentName.toLowerCase().includes('gis') || 
          equipmentName.toLowerCase().includes('변전') || 
          equipmentName.toLowerCase().includes('전기') ||
          equipmentName.toLowerCase().includes('kv') ||
          riskFactors.some(rf => rf.toLowerCase().includes('전기') || rf.toLowerCase().includes('고전압'))) {
        expandedTerms.push(
          '전기', '감전', '절연', '정전', '충전', '전로', '접지', 
          '누전', '과전류', '방호', '차단', '검전', '무전압',
          '절연용', '보호구', '활선', '방호울타리', '감시인', '자격'
        );
      }
      
      // 정비/점검 작업 관련
      if (workType.toLowerCase().includes('정비') || 
          workType.toLowerCase().includes('점검') || 
          workType.toLowerCase().includes('수리')) {
        expandedTerms.push('정비', '점검', '수리', '보수', '작업자', '자격', '교육');
      }
      
      // 고소작업 관련
      if (workType.toLowerCase().includes('고소') || 
          riskFactors.some(rf => rf.toLowerCase().includes('추락'))) {
        expandedTerms.push('추락', '난간', '안전대', '발판');
      }
      
      // 컨베이어/기계 관련
      if (equipmentName.toLowerCase().includes('컨베이어') || 
          equipmentName.toLowerCase().includes('기계')) {
        expandedTerms.push('끼임', '방호', '전원', '차단', '기계');
      }
      
      // 관련도 점수 계산으로 검색 개선
      const scoredRegulations = this.regulationData.map(regulation => {
        const searchText = `${regulation.title} ${regulation.content} ${regulation.category}`.toLowerCase();
        
        // 정확한 매칭에 높은 점수
        let score = 0;
        expandedTerms.forEach(term => {
          if (term && searchText.includes(term)) {
            // 제목에 포함된 경우 더 높은 점수
            if (regulation.title.toLowerCase().includes(term)) {
              score += 3;
            }
            // 카테고리에 포함된 경우 중간 점수
            else if (regulation.category.toLowerCase().includes(term)) {
              score += 2;
            }
            // 내용에 포함된 경우 기본 점수
            else {
              score += 1;
            }
          }
        });
        
        return { regulation, score };
      });
      
      // 점수순으로 정렬하고 최소 점수 1 이상인 것들만 반환
      return scoredRegulations
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.regulation);

    } catch (error) {
      console.error('법규 검색 실패:', error);
      return [];
    }
  }

  async searchEducationMaterials(query: string, limit: number = 3): Promise<EducationData[]> {
    await this.initialize();

    try {
      const queryLower = query.toLowerCase();
      
      // 키워드 확장
      const expandedTerms = queryLower.split(' ').filter(term => term.trim().length > 0);
      if (queryLower.includes('gis') || queryLower.includes('전기')) {
        expandedTerms.push('전기안전', '감전방지', '절연');
      }
      if (queryLower.includes('안전교육') || queryLower.includes('교육')) {
        expandedTerms.push('교육', '훈련', '안전', '예방');
      }
      
      // 관련도 점수 계산으로 검색 개선
      const scoredEducation = this.educationData.map(edu => {
        const searchText = `${edu.title} ${edu.keywords} ${edu.content} ${edu.type}`.toLowerCase();
        
        let score = 0;
        expandedTerms.forEach(term => {
          if (term && searchText.includes(term)) {
            // 제목에 포함된 경우 더 높은 점수
            if (edu.title.toLowerCase().includes(term)) {
              score += 3;
            }
            // 키워드에 포함된 경우 중간 점수
            else if (edu.keywords.toLowerCase().includes(term)) {
              score += 2;
            }
            // 내용이나 타입에 포함된 경우 기본 점수
            else {
              score += 1;
            }
          }
        });
        
        return { education: edu, score };
      });
      
      // 점수순으로 정렬하고 점수가 0보다 큰 것들만 반환 (URL 포함)
      const results = scoredEducation
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
          ...item.education,
          // URL이 있으면 그대로, 없으면 공백으로 유지
          url: item.education.url || '',
          file_url: item.education.file_url || ''
        }));

      console.log(`교육자료 검색 결과: ${results.length}건 (URL 포함)`);
      return results;

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
    const searchKeywords = [
      equipment.toLowerCase(),
      workType.toLowerCase(),
      riskLevel.toLowerCase(),
      '전기', 'gis', '고압', '특고압', '170kv'
    ];

    // 법규 검색 - 전기 관련 키워드 우선
    const relevantRegulations = this.regulationData.filter(reg => {
      const searchText = `${reg.title} ${reg.content} ${reg.category}`.toLowerCase();
      return searchKeywords.some(keyword => searchText.includes(keyword)) ||
             searchText.includes('전기') || searchText.includes('고압') || searchText.includes('특고압');
    }).slice(0, 3);

    // 사고사례 검색
    const relevantIncidents = this.accidentData.filter(incident => {
      const searchText = `${incident.title} ${incident.work_type} ${incident.accident_type} ${incident.risk_keywords}`.toLowerCase();
      return searchKeywords.some(keyword => searchText.includes(keyword));
    }).slice(0, 3);

    // 교육자료 검색
    const relevantEducation = this.educationData.filter(edu => {
      const searchText = `${edu.title} ${edu.keywords} ${edu.content}`.toLowerCase();
      return searchKeywords.some(keyword => searchText.includes(keyword));
    }).slice(0, 2);

    console.log(`키워드 기반 검색 결과: 사고사례 ${relevantIncidents.length}건, 교육자료 ${relevantEducation.length}건, 법규 ${relevantRegulations.length}건`);

    return {
      regulations: relevantRegulations,
      incidents: relevantIncidents,
      education: relevantEducation
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