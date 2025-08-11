import { LocalIndex } from 'vectra';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
// PDF 파싱을 위한 dynamic import 사용

export interface EmbeddingCheckpoint {
  timestamp: string;
  phase: 'incidents' | 'education' | 'regulations';
  lastCompletedIndex: number;
  totalCount: number;
  totalItemsProcessed: number;
  dataHashes: {
    incidents: string;
    education: string;
    regulations: string;
  };
}

export interface SearchResult {
  document: string;
  metadata: any;
  distance: number;
}

export interface CategorizedSearchResult {
  education: SearchResult[];
  incident: SearchResult[];
  regulation: SearchResult[];
  totalFound: {
    education: number;
    incident: number;
    regulation: number;
  };
}

export class ChromaDBService {
  private index: LocalIndex;
  private openai: OpenAI;
  private isInitialized = false;
  private forceRebuildFlag = false;
  private readonly indexPath = './data/vectra-index';
  private readonly checkpointPath = './data/embedding-checkpoint.json';
  private readonly backupPath = './data/vectra-backup';

  constructor() {
    // Vectra LocalIndex (파일 기반 임베디드 모드)
    this.index = new LocalIndex(this.indexPath);
    
    // OpenAI for embeddings
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
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

      // OpenAI API 테스트
      if (!process.env.OPENAI_API_KEY) {
        console.log('OpenAI API 키가 없어 Vectra 초기화 중단');
        this.isInitialized = true;
        return;
      }

      try {
        console.log('OpenAI API 임베딩 테스트 중...');
        await this.generateEmbedding('test');
        console.log('OpenAI API 테스트 성공, 데이터 임베딩 진행');
        
        // 데이터 로드 및 임베딩
        await this.loadAndEmbedData();
        
      } catch (error: any) {
        console.log('OpenAI API 오류, Vectra 임베딩 건너뜀:', error.message);
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
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002", // 1536 차원, 가장 저렴한 모델
        input: text.substring(0, 8000), // 토큰 제한 적용
        encoding_format: 'float'
      });
      
      return response.data[0].embedding;
    } catch (error: any) {
      if ((error.status === 429 || error.status === 500) && retryCount < 3) {
        // 할당량 초과 또는 서버 오류 시 대기 후 재시도
        const waitTime = error.status === 500 ? 5000 : Math.pow(2, retryCount) * 1000; // OpenAI는 더 짧은 대기
        console.log(`OpenAI API ${error.status === 500 ? '서버' : '할당량'} 오류, ${waitTime/1000}초 대기 후 재시도... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.generateEmbedding(text, retryCount + 1);
      }
      console.error('OpenAI 임베딩 생성 실패:', error);
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

  // 체크포인트 관리 메서드들
  private async saveCheckpoint(checkpoint: EmbeddingCheckpoint): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.checkpointPath), { recursive: true });
      await fs.writeFile(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
      console.log(`체크포인트 저장: ${checkpoint.phase} ${checkpoint.lastCompletedIndex}/${checkpoint.totalCount}`);
    } catch (error) {
      console.error('체크포인트 저장 실패:', error);
    }
  }

  private async loadCheckpoint(): Promise<EmbeddingCheckpoint | null> {
    try {
      const data = await fs.readFile(this.checkpointPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null; // 체크포인트 파일이 없으면 null 반환
    }
  }

  private async createBackup(): Promise<void> {
    try {
      console.log('벡터DB 백업 생성 중...');
      await fs.mkdir(this.backupPath, { recursive: true });
      
      // 원본 인덱스 파일들을 백업 폴더로 복사
      const sourceFiles = await fs.readdir(this.indexPath).catch(() => []);
      for (const file of sourceFiles) {
        const sourcePath = path.join(this.indexPath, file);
        const backupPath = path.join(this.backupPath, file);
        await fs.copyFile(sourcePath, backupPath);
      }
      
      console.log('벡터DB 백업 완료');
    } catch (error) {
      console.error('백업 생성 실패:', error);
    }
  }

  private async restoreFromBackup(): Promise<boolean> {
    try {
      console.log('백업에서 복구 중...');
      const backupFiles = await fs.readdir(this.backupPath).catch(() => []);
      
      if (backupFiles.length === 0) {
        console.log('백업 파일을 찾을 수 없습니다.');
        return false;
      }

      await fs.mkdir(this.indexPath, { recursive: true });
      for (const file of backupFiles) {
        const backupFilePath = path.join(this.backupPath, file);
        const targetPath = path.join(this.indexPath, file);
        await fs.copyFile(backupFilePath, targetPath);
      }
      
      console.log('백업에서 복구 완료');
      return true;
    } catch (error) {
      console.error('백업 복구 실패:', error);
      return false;
    }
  }

  private shouldResumeFromCheckpoint(checkpoint: EmbeddingCheckpoint, currentItems: number): boolean {
    // 현재 아이템 수가 체크포인트보다 적으면 복구 필요
    const expectedItems = checkpoint.totalItemsProcessed;
    const isIncomplete = currentItems < expectedItems * 0.9; // 10% 오차 허용
    
    console.log(`복구 판단: 현재 ${currentItems}개, 예상 ${expectedItems}개, 복구 필요: ${isIncomplete}`);
    return isIncomplete;
  }

  private async resumeEmbeddingFromCheckpoint(checkpoint: EmbeddingCheckpoint): Promise<void> {
    console.log(`${checkpoint.phase} 단계 ${checkpoint.lastCompletedIndex}번부터 재개합니다.`);
    
    // 체크포인트 정보를 사용하여 해당 단계부터 다시 시작
    await this.continueEmbeddingFromPhase(checkpoint.phase, checkpoint.lastCompletedIndex + 1);
  }

  private async continueEmbeddingFromPhase(phase: string, startIndex: number): Promise<void> {
    // 데이터 로드
    const { accidentCases, educationData, pdfRegulations } = await this.loadAllData();
    
    if (phase === 'incidents') {
      await this.processIncidents(accidentCases, startIndex);
      await this.processEducation(educationData, 0);
      await this.processRegulations(pdfRegulations, 0);
    } else if (phase === 'education') {
      await this.processEducation(educationData, startIndex);
      await this.processRegulations(pdfRegulations, 0);
    } else if (phase === 'regulations') {
      await this.processRegulations(pdfRegulations, startIndex);
    }
  }

  private async loadAllData(): Promise<{accidentCases: any[], educationData: any[], pdfRegulations: any[]}> {
    // 1. 사고사례 데이터 로드
    const accidentCasesPath = path.join(process.cwd(), 'embed_data', 'accident_cases_for_rag.json');
    let accidentCases = [];
    try {
      const accidentData = await fs.readFile(accidentCasesPath, 'utf-8');
      accidentCases = JSON.parse(accidentData);
      console.log(`사고사례 ${accidentCases.length}건 로드`);
    } catch (error) {
      console.log('사고사례 데이터 파일을 찾을 수 없습니다.');
    }

    // 2. 교육자료 데이터 로드
    const educationDataPath = path.join(process.cwd(), 'embed_data', 'education_data.json');
    let educationData = [];
    try {
      const eduData = await fs.readFile(educationDataPath, 'utf-8');
      educationData = JSON.parse(eduData);
      console.log(`교육자료 ${educationData.length}건 로드`);
    } catch (error) {
      console.log('교육자료 데이터 파일을 찾을 수 없습니다.');
    }

    // 3. PDF 안전법규 데이터 로드
    const pdfJsonPath = path.join(process.cwd(), 'embed_data', 'pdf_regulations_chunks.json');
    let pdfRegulations: any[] = [];
    try {
      const pdfData = await fs.readFile(pdfJsonPath, 'utf-8');
      pdfRegulations = JSON.parse(pdfData);
      console.log(`PDF 안전법규 청크 ${pdfRegulations.length}건 로드`);
    } catch (error) {
      console.log('PDF 법규 파일이 없어 건너뜁니다.');
    }

    return { accidentCases, educationData, pdfRegulations };
  }

  private async processIncidents(accidentCases: any[], startIndex: number): Promise<void> {
    for (let i = startIndex; i < accidentCases.length; i++) {
      try {
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

        console.log(`사고사례 ${i + 1}/${accidentCases.length} 임베딩 완료`);

        // 50개마다 체크포인트 저장
        if ((i + 1) % 50 === 0) {
          await this.saveCheckpoint({
            timestamp: new Date().toISOString(),
            phase: 'incidents',
            lastCompletedIndex: i,
            totalCount: accidentCases.length,
            totalItemsProcessed: i + 1,
            dataHashes: { incidents: 'hash', education: 'hash', regulations: 'hash' }
          });
        }
      } catch (error) {
        console.error(`사고사례 ${i} 처리 실패:`, error);
        // 백업에서 복구 시도
        const restored = await this.restoreFromBackup();
        if (restored) {
          throw new Error(`사고사례 임베딩 중 오류 발생, 백업에서 복구됨. 다시 시도해주세요.`);
        }
        throw error;
      }
    }
  }

  private async processEducation(educationData: any[], startIndex: number): Promise<void> {
    for (let i = startIndex; i < educationData.length; i++) {
      try {
        const edu = educationData[i];
        const content = `${edu.title}\n${edu.content}\n카테고리: ${edu.type || edu.category}`;
        
        const embedding = await this.generateEmbedding(content);
        
        await this.index.upsertItem({
          id: `education_${i}`,
          vector: embedding,
          metadata: {
            type: 'education',
            title: edu.title,
            category: edu.type || edu.category,
            keywords: edu.keywords,
            date: edu.date,
            url: edu.url,
            content: content
          }
        });

        console.log(`교육자료 ${i + 1}/${educationData.length} 임베딩 완료`);

        // 100개마다 체크포인트 저장
        if ((i + 1) % 100 === 0) {
          await this.saveCheckpoint({
            timestamp: new Date().toISOString(),
            phase: 'education',
            lastCompletedIndex: i,
            totalCount: educationData.length,
            totalItemsProcessed: 1793 + i + 1, // 사고사례 + 현재 교육자료
            dataHashes: { incidents: 'hash', education: 'hash', regulations: 'hash' }
          });
        }
      } catch (error) {
        console.error(`교육자료 ${i} 처리 실패:`, error);
        const restored = await this.restoreFromBackup();
        if (restored) {
          throw new Error(`교육자료 임베딩 중 오류 발생, 백업에서 복구됨. 다시 시도해주세요.`);
        }
        throw error;
      }
    }
  }

  private async processRegulations(pdfRegulations: any[], startIndex: number): Promise<void> {
    for (let i = startIndex; i < pdfRegulations.length; i++) {
      try {
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

        console.log(`PDF 안전법규 청크 ${i + 1}/${pdfRegulations.length} 임베딩 완료`);

        // 20개마다 체크포인트 저장
        if ((i + 1) % 20 === 0) {
          await this.saveCheckpoint({
            timestamp: new Date().toISOString(),
            phase: 'regulations',
            lastCompletedIndex: i,
            totalCount: pdfRegulations.length,
            totalItemsProcessed: 1793 + 6501 + i + 1, // 사고사례 + 교육자료 + 현재 법규
            dataHashes: { incidents: 'hash', education: 'hash', regulations: 'hash' }
          });
        }
      } catch (error) {
        console.error(`안전법규 ${i} 처리 실패:`, error);
        const restored = await this.restoreFromBackup();
        if (restored) {
          throw new Error(`안전법규 임베딩 중 오류 발생, 백업에서 복구됨. 다시 시도해주세요.`);
        }
        throw error;
      }
    }
  }

  private async clearCheckpoint(): Promise<void> {
    try {
      await fs.unlink(this.checkpointPath);
    } catch (error) {
      // 파일이 없어도 문제없음
    }
  }

  // 공개 메서드들 (API에서 호출)
  public async getEmbeddingStatus(): Promise<any> {
    try {
      const checkpoint = await this.loadCheckpoint();
      const items = await this.index.listItems();
      
      return {
        hasCheckpoint: !!checkpoint,
        checkpoint: checkpoint,
        currentItems: items.length,
        indexPath: this.indexPath,
        backupExists: await this.hasBackup()
      };
    } catch (error) {
      return {
        hasCheckpoint: false,
        checkpoint: null,
        currentItems: 0,
        error: error.message
      };
    }
  }

  public async resumeFromCheckpoint(): Promise<boolean> {
    try {
      const checkpoint = await this.loadCheckpoint();
      if (!checkpoint) {
        return false;
      }

      console.log('체크포인트에서 재개:', checkpoint);
      await this.resumeEmbeddingFromCheckpoint(checkpoint);
      return true;
    } catch (error) {
      console.error('체크포인트 재개 실패:', error);
      return false;
    }
  }

  private async hasBackup(): Promise<boolean> {
    try {
      const files = await fs.readdir(this.backupPath);
      return files.length > 0;
    } catch (error) {
      return false;
    }
  }

  public async restoreFromBackup(): Promise<boolean> {
    try {
      const backupFiles = await fs.readdir(this.backupPath);
      if (backupFiles.length === 0) {
        return false;
      }

      // 가장 최근 백업 파일 찾기
      const latestBackup = backupFiles
        .filter(file => file.endsWith('.json'))
        .sort()
        .pop();

      if (!latestBackup) {
        return false;
      }

      console.log('백업에서 복구 중:', latestBackup);
      
      // 기존 인덱스 삭제
      await this.index.deleteCollection();
      
      // 새 인덱스 초기화
      await this.index.initialize();
      
      // 백업 데이터 로드
      const backupPath = path.join(this.backupPath, latestBackup);
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      
      // 백업에서 데이터 복원
      let restoredCount = 0;
      for (const item of backupData) {
        try {
          await this.index.addItem({
            vector: item.vector,
            metadata: item.metadata
          });
          restoredCount++;
        } catch (error) {
          console.error('아이템 복원 실패:', error);
        }
      }

      console.log(`백업에서 ${restoredCount}개 아이템 복원 완료`);
      return true;
    } catch (error) {
      console.error('백업 복구 실패:', error);
      return false;
    }
  }

  // 상세 분석 정보 제공
  public async getDetailedAnalysis(): Promise<any> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const items = await this.index.listItems();
      console.log(`분석 대상 아이템 수: ${items.length}`);

      const categoryBreakdown: Record<string, number> = {};
      const industryBreakdown: Record<string, number> = {};
      const workTypeBreakdown: Record<string, number> = {};
      const sampleDocuments: any[] = [];

      // 모든 아이템 분석
      for (const item of items) {
        const metadata = item.metadata;
        
        // 카테고리별 분류
        const category = metadata.type || 'unknown';
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;

        // 산업별 분류 (사고사례에만 해당)
        if (metadata.industry) {
          const industry = metadata.industry;
          industryBreakdown[industry] = (industryBreakdown[industry] || 0) + 1;
        }

        // 작업유형별 분류
        if (metadata.work_type) {
          const workType = metadata.work_type;
          workTypeBreakdown[workType] = (workTypeBreakdown[workType] || 0) + 1;
        }

        // 샘플 문서 수집 (각 카테고리별로 3개씩)
        const categoryCount = sampleDocuments.filter(doc => doc.type === category).length;
        if (categoryCount < 3) {
          sampleDocuments.push({
            type: category,
            title: metadata.title || 'No Title',
            industry: metadata.industry || '',
            workType: metadata.work_type || '',
            date: metadata.date || '',
            content: metadata.content ? metadata.content.substring(0, 200) + '...' : ''
          });
        }
      }

      // 카테고리명 한글화
      const categoryNames: Record<string, string> = {
        'incident': '사고사례',
        'education': '교육자료',
        'regulation': '안전법규'
      };

      const formattedCategoryBreakdown: Record<string, number> = {};
      Object.keys(categoryBreakdown).forEach(key => {
        const koreanName = categoryNames[key] || key;
        formattedCategoryBreakdown[koreanName] = categoryBreakdown[key];
      });

      return {
        totalDocuments: items.length,
        categoryBreakdown: formattedCategoryBreakdown,
        industryBreakdown,
        workTypeBreakdown,
        sampleDocuments,
        lastAnalyzed: new Date().toISOString()
      };

    } catch (error) {
      console.error('상세 분석 실패:', error);
      throw error;
    }
  }

  private async loadAndEmbedData(): Promise<void> {
    try {
      // 체크포인트 로드
      const checkpoint = await this.loadCheckpoint();
      
      // 기존 데이터 확인 (forceRebuild 플래그가 있으면 무시)
      const items = await this.index.listItems();
      if (items.length > 0 && !this.forceRebuildFlag) {
        console.log(`Vectra에 이미 ${items.length}개의 문서가 있습니다.`);
        
        // 중단점 복구 로직
        if (checkpoint && this.shouldResumeFromCheckpoint(checkpoint, items.length)) {
          console.log(`체크포인트에서 복구 시작: ${checkpoint.lastCompletedIndex}에서 재개`);
          await this.resumeEmbeddingFromCheckpoint(checkpoint);
          return;
        } else {
          console.log('기존 데이터 유지합니다.');
          return;
        }
      }

      console.log('/embed_data 폴더에서 데이터 로드 및 임베딩 시작...');

      // 백업 생성
      await this.createBackup();

      // 데이터 로드
      const { accidentCases, educationData, pdfRegulations } = await this.loadAllData();

      // 단계별 처리 (체크포인트와 함께)
      await this.processIncidents(accidentCases, 0);
      await this.processEducation(educationData, 0);
      await this.processRegulations(pdfRegulations, 0);

      // 최종 체크포인트 제거
      await this.clearCheckpoint();
      console.log('모든 임베딩 완료, 체크포인트 정리됨');

    } catch (error) {
      console.error('데이터 로드 및 임베딩 실패:', error);
      throw error;
    }
  }

  // 검색용 쿼리 임베딩 생성 (별도 메서드)
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: query.substring(0, 8000),
        encoding_format: 'float'
      });
      
      return response.data[0].embedding;
    } catch (error: any) {
      console.error('OpenAI 쿼리 임베딩 생성 실패:', error);
      throw error;
    }
  }

  async searchRelevantData(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // OpenAI API 할당량 문제가 있으면 빈 결과 반환
      if (!process.env.OPENAI_API_KEY) {
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
      const results = await this.index.queryItems(queryEmbedding, 10000); // 큰 수를 지정
      
      // 유사도 점수로 정렬하고 상위 limit개만 선택
      const topResults = results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      console.log(`원시 검색 결과 (상위 ${topResults.length}개):`, 
        topResults.map(r => ({ score: r.score, title: r.item.metadata?.title || 'No title' })));

      // 결과 포맷팅
      const searchResults: SearchResult[] = topResults.map(result => ({
        document: (result.item.metadata?.content as string) || '',
        metadata: result.item.metadata || {},
        distance: result.score
      }));

      console.log(`Vectra 검색 완료: ${searchResults.length}개 결과 (전체 ${results.length}개 중)`);
      return searchResults;

    } catch (error: any) {
      console.log('OpenAI API 오류로 Vectra 검색 실패:', error.message);
      return [];
    }
  }

  async searchByCategory(query: string, limitPerCategory: number = 5): Promise<CategorizedSearchResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // OpenAI API 할당량 문제가 있으면 빈 결과 반환
      if (!process.env.OPENAI_API_KEY) {
        return {
          education: [],
          incident: [],
          regulation: [],
          totalFound: { education: 0, incident: 0, regulation: 0 }
        };
      }

      // 쿼리 임베딩 생성
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // 모든 결과 가져오기
      const results = await this.index.queryItems(queryEmbedding, 10000);
      const sortedResults = results.sort((a, b) => b.score - a.score);

      // 카테고리별로 분류
      const educationResults: SearchResult[] = [];
      const incidentResults: SearchResult[] = [];
      const regulationResults: SearchResult[] = [];

      for (const result of sortedResults) {
        const type = result.item.metadata?.type;
        const searchResult: SearchResult = {
          document: (result.item.metadata?.content as string) || '',
          metadata: result.item.metadata || {},
          distance: result.score
        };

        if (type === 'education' && educationResults.length < limitPerCategory) {
          educationResults.push(searchResult);
        } else if (type === 'incident' && incidentResults.length < limitPerCategory) {
          incidentResults.push(searchResult);
        } else if (type === 'regulation' && regulationResults.length < limitPerCategory) {
          regulationResults.push(searchResult);
        }

        // 모든 카테고리가 채워지면 중단
        if (educationResults.length >= limitPerCategory && 
            incidentResults.length >= limitPerCategory && 
            regulationResults.length >= limitPerCategory) {
          break;
        }
      }

      // 전체 카테고리별 개수 계산
      const totalCounts = sortedResults.reduce((acc, result) => {
        const type = result.item.metadata?.type;
        if (type === 'education') acc.education++;
        else if (type === 'incident') acc.incident++;
        else if (type === 'regulation') acc.regulation++;
        return acc;
      }, { education: 0, incident: 0, regulation: 0 });

      console.log(`카테고리별 검색 완료 - 교육자료: ${educationResults.length}개, 사고사례: ${incidentResults.length}개, 관련규정: ${regulationResults.length}개`);

      return {
        education: educationResults,
        incident: incidentResults,
        regulation: regulationResults,
        totalFound: totalCounts
      };

    } catch (error: any) {
      console.log('카테고리별 벡터 검색 실패:', error.message);
      return {
        education: [],
        incident: [],
        regulation: [],
        totalFound: { education: 0, incident: 0, regulation: 0 }
      };
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

  // 특정 타입의 데이터만 재구성하는 메서드
  async rebuildPartialData(dataTypes: ('incident' | 'education' | 'regulation')[]): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(`부분 재구성 시작: ${dataTypes.join(', ')}`);
      console.log('dataTypes 배열 내용:', dataTypes);
      console.log('dataTypes 타입:', typeof dataTypes);

      // 기존 데이터 삭제 (해당 타입만)
      const existingItems = await this.index.listItems();
      for (const item of existingItems) {
        const itemDetail = await this.index.getItem(item.id);
        if (itemDetail?.metadata?.type && dataTypes.includes(itemDetail.metadata.type as any)) {
          await this.index.deleteItem(item.id);
          console.log(`기존 ${itemDetail.metadata.type} 데이터 삭제: ${item.id}`);
        }
      }

      let totalItems = 0;

      // 교육자료만 재구성
      if (dataTypes.includes('education')) {
        const educationDataPath = path.join(process.cwd(), 'embed_data', 'education_data.json');
        try {
          const eduData = await fs.readFile(educationDataPath, 'utf-8');
          const educationData = JSON.parse(eduData);
          console.log(`교육자료 ${educationData.length}건 재구성 시작`);

          for (let i = 0; i < educationData.length; i++) {
            const edu = educationData[i];
            const content = `${edu.title}\n${edu.content}\n카테고리: ${edu.type || edu.category}`;
            
            const embedding = await this.generateEmbedding(content);
            
            await this.index.upsertItem({
              id: `education_${i}`,
              vector: embedding,
              metadata: {
                type: 'education',
                title: edu.title,
                category: edu.type || edu.category,
                keywords: edu.keywords,
                date: edu.date,
                url: edu.url,
                content: content
              }
            });

            totalItems++;
            if (i % 100 === 0) {
              console.log(`교육자료 ${i + 1}/${educationData.length} 재구성 완료`);
            }
          }
        } catch (error) {
          console.log('교육자료 재구성 실패:', error);
        }
      }

      // 안전법규 재구성
      if (dataTypes.includes('regulation')) {
        const regulationDataPath = path.join(process.cwd(), 'embed_data', 'pdf_regulations_chunks.json');
        console.log(`안전법규 파일 경로: ${regulationDataPath}`);
        try {
          console.log('안전법규 파일 읽기 시도...');
          const regData = await fs.readFile(regulationDataPath, 'utf-8');
          const regulationData = JSON.parse(regData);
          console.log(`안전법규 ${regulationData.length}건 재구성 시작`);
          console.log('첫 번째 안전법규 데이터 샘플:', JSON.stringify(regulationData[0], null, 2));

          for (let i = 0; i < regulationData.length; i++) {
            const reg = regulationData[i];
            const content = `${reg.title}\n${reg.content}\n카테고리: ${reg.category}`;
            
            const embedding = await this.generateEmbedding(content);
            
            await this.index.upsertItem({
              id: `regulation_${i}`,
              vector: embedding,
              metadata: {
                type: 'regulation',
                title: reg.title,
                category: reg.category,
                chunk_id: reg.chunk_id,
                page_number: reg.page_number,
                source: reg.source,
                content: content
              }
            });

            totalItems++;
            if (i % 50 === 0) {
              console.log(`안전법규 ${i + 1}/${regulationData.length} 재구성 완료`);
            }
            
            // API 제한 방지를 위한 딜레이
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.log('안전법규 재구성 실패:', error);
        }
      }

      console.log(`부분 재구성 완료: ${totalItems}개 문서 처리`);

    } catch (error) {
      console.error('부분 재구성 실패:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 생성 (Vectra 기반)
export const chromaDBService = new ChromaDBService();