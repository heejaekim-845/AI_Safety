import { LocalIndex } from "vectra";
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';

// 기존 데이터 타입들
interface AccidentCase {
  title: string;
  work_type: string;
  accident_type: string;
  date: string;
  location: string;
  summary: string;
  direct_cause: string;
  risk_keywords: string;
}

interface EducationData {
  title: string;
  type: string;
  keywords: string;
  content: string;
  date: string;
  doc_number: string;
}

interface SafetyRegulation {
  title: string;
  article_number: string;
  content: string;
  category: string;
}

export class VectorDBService {
  private vectorIndex: LocalIndex;
  private openai: OpenAI;
  private accidentData: AccidentCase[] = [];
  private educationData: EducationData[] = [];
  private regulationData: SafetyRegulation[] = [];
  private isInitialized = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Vectra 인덱스 초기화 (로컬 파일 저장)
    const indexPath = path.join(process.cwd(), 'data', 'vector-index');
    this.vectorIndex = new LocalIndex(indexPath);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('VectorDB Service 초기화 시작...');
      
      // JSON 파일들에서 데이터 로드
      await this.loadInitialData();
      
      // OpenAI API 키 확인
      if (!process.env.OPENAI_API_KEY) {
        console.log('OpenAI API 키가 없어 키워드 기반 검색만 사용');
        this.isInitialized = true;
        return;
      }
      
      // Vectra 벡터 인덱스에 데이터 추가
      await this.populateVectorDB();
      
      this.isInitialized = true;
      console.log('VectorDB Service 초기화 완료');
    } catch (error) {
      console.error('VectorDB Service 초기화 실패:', error);
      this.isInitialized = true; // 키워드 기반 검색으로 폴백
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
          title: "제301조(전기기계·기구의 방호)",
          article_number: "제301조",
          content: "사업주는 근로자가 전기에 의하여 위험을 입을 우려가 있는 장소에 전기기계·기구를 설치하는 경우에는 충전부가 노출되지 아니하도록 폐쇄형 구조로 하거나 절연덮개 등 적절한 방호장치를 설치하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제302조(접지)",
          article_number: "제302조",
          content: "사업주는 전기설비의 금속제 외함, 금속제 전선관 등 충전될 우려가 있는 부분에 대하여는 접지를 실시하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제303조(절연용 보호구 등의 사용)",
          article_number: "제303조",
          content: "사업주는 근로자가 충전전로에 가까운 장소에서 작업을 하는 경우 절연용 보호구 또는 절연용 방호구를 착용하도록 하여야 한다.",
          category: "전기안전"
        }
      ];
      console.log(`법규 ${this.regulationData.length}건 로드 완료`);
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
      throw error;
    }
  }

  private async populateVectorDB(): Promise<void> {
    try {
      // Vectra 인덱스가 이미 존재하는지 확인
      if (!await this.vectorIndex.isIndexCreated()) {
        await this.vectorIndex.createIndex();
      }

      // 기존 데이터가 있는지 확인
      const stats = await this.vectorIndex.getIndexStats();
      if (stats.items > 0) {
        console.log(`기존 벡터 인덱스 발견: ${stats.items}개 벡터`);
        return;
      }

      let vectorCount = 0;

      // 사고사례 벡터화
      for (let i = 0; i < this.accidentData.length; i++) {
        const accident = this.accidentData[i];
        const text = `${accident.title} ${accident.work_type} ${accident.accident_type} ${accident.summary} ${accident.direct_cause} ${accident.risk_keywords}`;
        const vector = await this.generateEmbedding(text);
        
        await this.vectorIndex.insertItem({
          id: `accident_${i}`,
          vector: vector,
          metadata: {
            type: 'accident',
            work_type: accident.work_type,
            accident_type: accident.accident_type,
            date: accident.date,
            location: accident.location,
            text: text,
            title: accident.title,
            summary: accident.summary,
            direct_cause: accident.direct_cause,
            risk_keywords: accident.risk_keywords
          }
        });
        vectorCount++;
      }
      console.log(`사고사례 ${this.accidentData.length}건 벡터화 완료`);

      // 교육자료 벡터화
      for (let i = 0; i < this.educationData.length; i++) {
        const education = this.educationData[i];
        const text = `${education.title} ${education.type} ${education.keywords} ${education.content}`;
        const vector = await this.generateEmbedding(text);
        
        await this.vectorIndex.insertItem({
          id: `education_${i}`,
          vector: vector,
          metadata: {
            type: 'education',
            doc_type: education.type,
            date: education.date,
            doc_number: education.doc_number,
            text: text,
            title: education.title,
            keywords: education.keywords,
            content: education.content
          }
        });
        vectorCount++;
      }
      console.log(`교육자료 ${this.educationData.length}건 벡터화 완료`);

      // 법규 벡터화
      for (let i = 0; i < this.regulationData.length; i++) {
        const regulation = this.regulationData[i];
        const text = `${regulation.title} ${regulation.content} ${regulation.category}`;
        const vector = await this.generateEmbedding(text);
        
        await this.vectorIndex.insertItem({
          id: `regulation_${i}`,
          vector: vector,
          metadata: {
            type: 'regulation',
            article_number: regulation.article_number,
            category: regulation.category,
            text: text,
            title: regulation.title,
            content: regulation.content
          }
        });
        vectorCount++;
      }
      console.log(`법규 ${this.regulationData.length}건 벡터화 완료`);

      console.log(`총 ${vectorCount}개 벡터 생성 완료`);

    } catch (error) {
      console.error('벡터 데이터베이스 입력 실패:', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('임베딩 생성 실패:', error);
      throw error;
    }
  }

  async searchRelevantData(equipment: string, workType: string, riskLevel: string): Promise<{
    regulations: SafetyRegulation[];
    incidents: AccidentCase[];
    education: EducationData[];
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 벡터 검색 쿼리 생성
      const searchQuery = `${equipment} ${workType} ${riskLevel} 전기 안전 GIS 고압 특고압 170kV`;
      
      // 검색 쿼리를 벡터로 변환
      const queryVector = await this.generateEmbedding(searchQuery);
      
      // Vectra 벡터 검색 수행
      const results = await this.vectorIndex.queryItems(queryVector, 10, 0.7);
      
      const regulations: SafetyRegulation[] = [];
      const incidents: AccidentCase[] = [];
      const education: EducationData[] = [];

      // 결과 분류
      for (const result of results) {
        const metadata = result.item.metadata;
        if (metadata?.type === 'regulation') {
          regulations.push({
            title: metadata.title,
            article_number: metadata.article_number,
            content: metadata.content,
            category: metadata.category
          });
        } else if (metadata?.type === 'accident') {
          incidents.push({
            title: metadata.title,
            work_type: metadata.work_type,
            accident_type: metadata.accident_type,
            date: metadata.date,
            location: metadata.location,
            summary: metadata.summary,
            direct_cause: metadata.direct_cause,
            risk_keywords: metadata.risk_keywords
          });
        } else if (metadata?.type === 'education') {
          education.push({
            title: metadata.title,
            type: metadata.doc_type,
            keywords: metadata.keywords,
            content: metadata.content,
            date: metadata.date,
            doc_number: metadata.doc_number
          });
        }
      }

      console.log(`Vectra 벡터 검색 결과: 사고사례 ${incidents.length}건, 교육자료 ${education.length}건, 법규 ${regulations.length}건`);

      return {
        regulations: regulations.slice(0, 3),
        incidents: incidents.slice(0, 3),
        education: education.slice(0, 2)
      };

    } catch (error) {
      console.error('Vectra 벡터 검색 실패, 키워드 기반으로 폴백:', error);
      return await this.performKeywordSearch(equipment, workType, riskLevel);
    }
  }

  private async performKeywordSearch(equipment: string, workType: string, riskLevel: string): Promise<{
    regulations: SafetyRegulation[];
    incidents: AccidentCase[];
    education: EducationData[];
  }> {
    // 키워드 기반 폴백 검색
    const keywords = [equipment, workType, riskLevel, '전기', 'GIS', '고압', '특고압', '170kV'].map(k => k?.toLowerCase()).filter(Boolean);
    
    const filteredIncidents = this.accidentData.filter(incident => {
      const text = `${incident.title} ${incident.work_type} ${incident.accident_type} ${incident.summary}`.toLowerCase();
      return keywords.some(keyword => text.includes(keyword));
    }).slice(0, 3);

    const filteredEducation = this.educationData.filter(edu => {
      const text = `${edu.title} ${edu.type} ${edu.keywords} ${edu.content}`.toLowerCase();
      return keywords.some(keyword => text.includes(keyword));
    }).slice(0, 2);

    const filteredRegulations = this.regulationData.filter(reg => {
      const text = `${reg.title} ${reg.content} ${reg.category}`.toLowerCase();
      return keywords.some(keyword => text.includes(keyword));
    }).slice(0, 3);

    console.log(`키워드 검색 결과: 사고사례 ${filteredIncidents.length}건, 교육자료 ${filteredEducation.length}건, 법규 ${filteredRegulations.length}건`);

    return {
      regulations: filteredRegulations,
      incidents: filteredIncidents,
      education: filteredEducation
    };
  }
}

// 싱글톤 인스턴스 생성
export const vectorDBService = new VectorDBService();