import { LocalIndex } from 'vectra';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
// PDF 파싱을 위한 dynamic import 사용

export interface SearchResult {
  document: string;
  metadata: any;
  distance: number;
}

export class ChromaDBService {
  private index: LocalIndex;
  private genai: GoogleGenAI;
  private isInitialized = false;
  private forceRebuildFlag = false;
  private readonly indexPath = './data/vectra-index';

  constructor() {
    // Vectra LocalIndex (파일 기반 임베디드 모드)
    this.index = new LocalIndex(this.indexPath);
    
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

  private async generateEmbedding(text: string, retryCount = 0): Promise<number[]> {
    try {
      const response = await this.genai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
          taskType: "RETRIEVAL_DOCUMENT", // 문서 임베딩용
          outputDimensionality: 768 // 저장 공간 효율을 위해 768 차원 사용
        }
      });
      
      const embedding = response.embeddings?.[0]?.values;
      return Array.isArray(embedding) ? embedding : Object.values(embedding || {});
    } catch (error: any) {
      if (error.status === 429 && retryCount < 3) {
        // 할당량 초과 시 대기 후 재시도
        const waitTime = Math.pow(2, retryCount) * 60 * 1000; // 1분, 2분, 4분 대기
        console.log(`API 할당량 초과, ${waitTime/60000}분 대기 후 재시도... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.generateEmbedding(text, retryCount + 1);
      }
      console.error('Gemini 임베딩 생성 실패:', error);
      throw error;
    }
  }

  // PDF 텍스트를 적절한 크기로 청킹하는 함수
  private chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // 오버랩을 위해 마지막 몇 문장을 유지
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-overlap);
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 50); // 너무 짧은 청크 제거
  }

  private async loadAndEmbedData(): Promise<void> {
    try {
      // 기존 데이터 확인 (forceRebuild 플래그가 있으면 무시)
      const items = await this.index.listItems();
      if (items.length > 0 && !this.forceRebuildFlag) {
        console.log(`Vectra에 이미 ${items.length}개의 문서가 있습니다. API 할당량을 고려하여 기존 데이터 유지합니다.`);
        return;
      }

      console.log('/embed_data 폴더에서 데이터 로드 및 임베딩 시작...');

      // 1. 사고사례 데이터 로드 (/embed_data 폴더에서) - 전체 데이터 사용
      const accidentCasesPath = path.join(process.cwd(), 'embed_data', 'accident_cases_for_rag.json');
      let accidentCases = [];
      try {
        const accidentData = await fs.readFile(accidentCasesPath, 'utf-8');
        accidentCases = JSON.parse(accidentData);
        console.log(`사고사례 ${accidentCases.length}건 로드 (전체)`);
      } catch (error) {
        console.log('embed_data 폴더에서 사고사례 데이터 파일을 찾을 수 없습니다.');
      }

      // 2. 교육자료 데이터 로드 (/embed_data 폴더에서) - 전체 데이터 사용
      const educationDataPath = path.join(process.cwd(), 'embed_data', 'education_data.json');
      let educationData = [];
      try {
        const eduData = await fs.readFile(educationDataPath, 'utf-8');
        educationData = JSON.parse(eduData);
        console.log(`교육자료 ${educationData.length}건 로드 (전체)`);
      } catch (error) {
        console.log('embed_data 폴더에서 교육자료 데이터 파일을 찾을 수 없습니다.', (error as Error).message);
      }

      // 3. PDF를 LangChain으로 청킹한 JSON 데이터 로드
      const pdfJsonPath = path.join(process.cwd(), 'embed_data', 'pdf_regulations_chunks.json');
      let pdfRegulations: any[] = [];
      try {
        const pdfData = await fs.readFile(pdfJsonPath, 'utf-8');
        pdfRegulations = JSON.parse(pdfData);
        console.log(`PDF 안전법규 청크 ${pdfRegulations.length}건 로드`);
      } catch (error) {
        console.log('PDF 청킹 JSON 파일을 찾을 수 없습니다. Python 스크립트로 생성 중...');
        // Python 스크립트 실행
        try {
          const { spawn } = require('child_process');
          const pythonProcess = spawn('python', [
            './scripts/pdf_chunking.py',
            './embed_data/산업안전보건기준에 관한 규칙(고용노동부령)(제00448호)(20250717)_1754373490895.pdf',
            './embed_data/pdf_regulations_chunks.json'
          ]);
          
          await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code: number) => {
              if (code === 0) {
                console.log('PDF 청킹 완료');
                resolve(code);
              } else {
                console.log('PDF 청킹 실패');
                reject(new Error(`Python script exit code: ${code}`));
              }
            });
          });
          
          // 생성된 파일 다시 로드
          const pdfData = await fs.readFile(pdfJsonPath, 'utf-8');
          pdfRegulations = JSON.parse(pdfData);
          console.log(`PDF 안전법규 청크 ${pdfRegulations.length}건 로드 완료`);
        } catch (pythonError) {
          console.log('Python PDF 청킹 실패:', pythonError);
        }
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

      // PDF 안전법규 청크 처리 (LangChain으로 생성된 청크들) - 전체 데이터 사용
      console.log(`PDF 법규 청크 ${pdfRegulations.length}개 전체 임베딩 시작`);
      for (let i = 0; i < pdfRegulations.length; i++) {
        const chunk = pdfRegulations[i];
        const content = `${chunk.title}\n${chunk.content}\n분류: ${chunk.category}`;
        
        const embedding = await this.generateEmbedding(content);
        
        await this.index.upsertItem({
          id: `pdf_regulation_${i}`,
          vector: embedding,
          metadata: {
            type: 'regulation',
            title: chunk.title,
            source: 'pdf_langchain',
            chunk_id: chunk.chunk_id,
            page_number: chunk.page_number,
            category: chunk.category,
            content: content
          }
        });

        totalItems++;
        console.log(`PDF 안전법규 청크 ${i + 1}/${pdfRegulations.length} 임베딩 완료`);
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
          taskType: "RETRIEVAL_QUERY", // 검색 쿼리용
          outputDimensionality: 768
        }
      });
      
      const embedding = response.embeddings?.[0]?.values;
      return Array.isArray(embedding) ? embedding : Object.values(embedding || {});
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

      // 저장된 아이템 확인
      const items = await this.index.listItems();
      console.log(`저장된 아이템 수: ${items.length}`);
      
      if (items.length > 0) {
        try {
          const firstItem = await this.index.getItem(items[0].id);
          console.log(`첫번째 아이템:`, {
            id: firstItem?.id,
            vector_length: firstItem?.vector?.length,
            metadata: firstItem?.metadata ? Object.keys(firstItem.metadata) : 'no metadata',
            metadata_title: firstItem?.metadata?.title
          });
        } catch (itemError) {
          console.error('아이템 조회 오류:', itemError);
        }
      }

      // Vectra에서 검색  
      console.log(`검색 쿼리: "${query}", 임베딩 차원: ${queryEmbedding.length}`);
      const results = await this.index.queryItems(queryEmbedding, limit);

      console.log(`원시 검색 결과:`, results.map(r => ({ score: r.score, title: r.item.metadata.title })));

      // 결과 포맷팅
      const searchResults: SearchResult[] = results.map(result => ({
        document: (result.item.metadata.content as string) || '',
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
      console.log(`벡터DB 실제 아이템 수: ${items.length}`);
      
      // 샘플 아이템 확인
      if (items.length > 0) {
        const sampleItem = await this.index.getItem(items[0].id);
        console.log(`샘플 아이템 메타데이터:`, sampleItem?.metadata);
      }
      
      return {
        count: items.length,
        collections: ['vectra-safety-rag']
      };
    } catch (error) {
      console.error('Vectra 통계 조회 실패:', error);
      return { count: 0, collections: [] };
    }
  }

  async forceRebuildIndex(): Promise<void> {
    try {
      console.log('벡터 DB 강제 재구축 시작...');
      
      this.isInitialized = false;
      this.forceRebuildFlag = true; // 강제 재구축 플래그 설정
      
      // 파일 시스템에서 인덱스 폴더 완전 삭제
      try {
        const fs = await import('fs/promises');
        await fs.rm(this.indexPath, { recursive: true, force: true });
        console.log('인덱스 폴더 완전 삭제 완료');
        
        // 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (fsError) {
        console.log('인덱스 폴더 삭제 중 오류 (무시):', fsError);
      }
      
      // 완전히 새로운 인덱스 인스턴스 생성
      this.index = new LocalIndex(this.indexPath);
      
      // 새로운 인덱스 생성
      await this.index.createIndex();
      console.log('새 인덱스 생성 완료');
      
      // 전체 데이터 임베딩
      await this.loadAndEmbedData();
      this.isInitialized = true;
      this.forceRebuildFlag = false; // 플래그 리셋
      console.log('벡터 DB 재구축 완료');
      
    } catch (error: any) {
      console.error('벡터 DB 재구축 실패:', error);
      this.forceRebuildFlag = false; // 오류 시에도 플래그 리셋
      throw error;
    }
  }

  // 특정 파일만 추가로 임베딩하는 메소드
  async addNewDocuments(filePaths: string[]): Promise<{success: boolean, message: string, addedCount: number}> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      let addedCount = 0;
      console.log(`새로운 문서 ${filePaths.length}개 파일 임베딩 시작...`);

      for (const filePath of filePaths) {
        try {
          const fullPath = path.join('./embed_data', filePath);
          const fileContent = await fs.readFile(fullPath, 'utf-8');
          
          let data: any[] = [];
          if (filePath.endsWith('.json')) {
            data = JSON.parse(fileContent);
          } else if (filePath.endsWith('.txt')) {
            // 텍스트 파일을 문단 단위로 분할
            const paragraphs = fileContent.split('\n\n').filter(p => p.trim().length > 0);
            data = paragraphs.map((paragraph, index) => ({
              title: `${filePath} - 문단 ${index + 1}`,
              content: paragraph.trim(),
              source: filePath
            }));
          }

          // 각 문서를 임베딩하여 추가
          for (let i = 0; i < data.length; i++) {
            const doc = data[i];
            try {
              const textToEmbed = this.prepareTextForEmbedding(doc);
              const embedding = await this.generateEmbedding(textToEmbed);
              
              const docId = `${filePath}_${i}_${Date.now()}`;
              await this.index.upsertItem({
                id: docId,
                vector: embedding,
                metadata: {
                  type: this.getDocumentType(filePath),
                  title: doc.title || doc.사고명칭 || doc.교육과정명 || `문서 ${i + 1}`,
                  source: filePath,
                  index: i,
                  content: textToEmbed
                }
              });
              
              addedCount++;
              console.log(`${filePath}의 문서 ${i + 1}/${data.length} 임베딩 완료`);
              
              // API 제한 방지를 위한 딜레이
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (embeddingError: any) {
              console.log(`임베딩 실패 (건너뜀): ${filePath} 문서 ${i + 1} - ${embeddingError.message}`);
            }
          }
          
        } catch (fileError: any) {
          console.error(`파일 처리 실패: ${filePath} - ${fileError.message}`);
        }
      }

      return {
        success: true,
        message: `성공적으로 ${addedCount}개 문서를 추가했습니다.`,
        addedCount
      };
      
    } catch (error: any) {
      console.error('새 문서 추가 실패:', error);
      return {
        success: false,
        message: `문서 추가 실패: ${error.message}`,
        addedCount: 0
      };
    }
  }

  // 문서 타입 결정 헬퍼 메소드
  private getDocumentType(filePath: string): string {
    if (filePath.includes('accident') || filePath.includes('사고')) {
      return 'accident_case';
    } else if (filePath.includes('education') || filePath.includes('교육')) {
      return 'education_material';
    } else if (filePath.includes('regulation') || filePath.includes('법규')) {
      return 'regulation';
    } else {
      return 'general';
    }
  }

  // 텍스트 임베딩 준비 헬퍼 메소드
  private prepareTextForEmbedding(doc: any): string {
    if (doc.사고명칭) {
      // 사고사례 문서
      return `사고명: ${doc.사고명칭}\n발생장소: ${doc.발생장소 || ''}\n사고유형: ${doc.사고유형 || ''}\n사고개요: ${doc.사고개요 || ''}\n사고원인: ${doc.사고원인 || ''}\n재발방지대책: ${doc.재발방지대책 || ''}`;
    } else if (doc.교육과정명) {
      // 교육자료 문서
      return `교육과정: ${doc.교육과정명}\n교육기관: ${doc.교육기관명 || ''}\n교육내용: ${doc.교육내용 || ''}\n교육대상: ${doc.교육대상 || ''}`;
    } else if (doc.title && doc.content) {
      // 일반 문서
      return `제목: ${doc.title}\n내용: ${doc.content}`;
    } else {
      // 기타
      return JSON.stringify(doc);
    }
  }
}

// 싱글톤 인스턴스 생성 (Vectra 기반)
export const chromaDBService = new ChromaDBService();