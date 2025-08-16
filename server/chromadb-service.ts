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

      // 인덱스 생성 또는 로드 (JSON 파싱 오류 처리 포함)
      try {
        if (!await this.index.isIndexCreated()) {
          console.log('새로운 Vectra 인덱스 생성 중...');
          await this.index.createIndex();
        }
      } catch (jsonError: any) {
        console.log('인덱스 파일 손상 감지, 재생성 중...', jsonError.message);
        // 손상된 인덱스 파일 제거
        try {
          await fs.rmdir(this.indexPath, { recursive: true });
        } catch (rmError) {
          console.log('기존 인덱스 삭제 실패, 계속 진행...');
        }
        // 인덱스 디렉토리 재생성
        await fs.mkdir(this.indexPath, { recursive: true });
        // 새 인덱스 생성
        await this.index.createIndex();
        console.log('새로운 인덱스 생성 완료');
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
        console.log('OpenAI API 테스트 성공');
        
        // 기존 데이터 확인 후 임베딩 여부 결정
        const existingItems = await this.index.listItems();
        if (existingItems.length > 0) {
          console.log(`Vectra에 이미 ${existingItems.length}개의 문서가 있어 임베딩을 건너뜁니다.`);
        } else {
          console.log('새로운 데이터 임베딩 시작...');
          await this.loadAndEmbedData();
        }
        
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

    // 2. 교육자료 데이터 로드 (여러 파일 시도)
    const educationPaths = [
      'education_data.json',
      'education_data_filter.json',
      'test_new_safety_data.json'
    ];
    
    let educationData = [];
    for (const filename of educationPaths) {
      const educationDataPath = path.join(process.cwd(), 'embed_data', filename);
      try {
        const eduData = await fs.readFile(educationDataPath, 'utf-8');
        const data = JSON.parse(eduData);
        educationData = educationData.concat(data);
        console.log(`교육자료 ${filename}에서 ${data.length}건 로드`);
      } catch (error) {
        // 파일이 없으면 다음 파일 시도
      }
    }
    console.log(`교육자료 총 ${educationData.length}건 로드`);

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
            title: incident.title || '',
            date: incident.date || '',
            location: incident.location || '',
            accident_type: incident.accident_type || '',
            damage: incident.damage || '',
            summary: incident.summary || '',
            direct_cause: incident.direct_cause || '',
            root_cause: incident.root_cause || '',
            prevention: incident.prevention || '',
            industry: incident.industry || '',
            work_type: incident.work_type || '',
            risk_keywords: incident.risk_keywords || '',
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

        // 200개마다 체크포인트 저장 (메모리 부담 줄임)
        if ((i + 1) % 200 === 0) {
          // 메모리 정리
          if (global.gc) {
            global.gc();
          }
          
          await this.saveCheckpoint({
            timestamp: new Date().toISOString(),
            phase: 'education',
            lastCompletedIndex: i,
            totalCount: educationData.length,
            totalItemsProcessed: 1793 + i + 1, // 사고사례 + 현재 교육자료
            dataHashes: { incidents: 'hash', education: 'hash', regulations: 'hash' }
          });
          console.log(`체크포인트 저장: education ${i}/${educationData.length}`);
          
          // 시스템 안정화 대기
          await new Promise(resolve => setTimeout(resolve, 300));
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

  // 부분 재구축 메서드 (누락된 데이터만 추가)
  public async resumeIncompleteEmbedding(): Promise<void> {
    try {
      console.log('누락된 데이터 확인 및 이어서 임베딩 시작...');
      
      // 현재 인덱스 상태 확인
      const items = await this.index.listItems();
      console.log(`현재 벡터DB 아이템 수: ${items.length}`);
      
      // 각 카테고리별 현재 개수 계산
      const categoryCount = { incident: 0, education: 0, regulation: 0 };
      for (const item of items) {
        const type = item.metadata?.type;
        if (type && categoryCount[type] !== undefined) {
          categoryCount[type]++;
        }
      }
      
      console.log('현재 카테고리별 개수:', categoryCount);
      
      // 원본 데이터 로드
      const { accidentCases, educationData, pdfRegulations } = await this.loadAllData();
      console.log(`원본 데이터: 사고사례 ${accidentCases.length}, 교육자료 ${educationData.length}, 안전법규 ${pdfRegulations.length}`);
      
      // 백업 생성
      await this.createBackup();
      
      // 누락된 데이터만 처리
      if (categoryCount.incident < accidentCases.length) {
        console.log(`사고사례 ${categoryCount.incident}/${accidentCases.length}에서 재개`);
        await this.processIncidents(accidentCases, categoryCount.incident);
      }
      
      if (categoryCount.education < educationData.length) {
        console.log(`교육자료 ${categoryCount.education}/${educationData.length}에서 재개`);
        await this.processEducation(educationData, categoryCount.education);
      }
      
      if (categoryCount.regulation < pdfRegulations.length) {
        console.log(`안전법규 ${categoryCount.regulation}/${pdfRegulations.length}에서 재개`);
        await this.processRegulations(pdfRegulations, categoryCount.regulation);
      }
      
      console.log('부분 재구축 완료');
      
    } catch (error) {
      console.error('부분 재구축 실패:', error);
      
      // 백업에서 복구 시도
      const restored = await this.restoreFromBackup();
      if (restored) {
        console.log('백업에서 복구 완료');
      }
      
      throw error;
    }
  }

  // 안전한 재구축 메서드
  public async rebuildVectorDB(forceRebuild: boolean = false): Promise<void> {
    try {
      console.log('안전한 벡터DB 재구축 시작, forceRebuild:', forceRebuild);
      
      if (forceRebuild) {
        // 백업 생성
        await this.createBackup();
        
        // 기존 인덱스 삭제
        console.log('기존 벡터DB 인덱스 삭제 중...');
        try {
          await this.index.deleteIndex();
        } catch (error) {
          console.log('인덱스 삭제 오류 무시 (없을 수 있음):', error.message);
        }
        
        // 새 인덱스 생성
        console.log('새 벡터DB 인덱스 생성 중...');
        await this.index.createIndex();
        
        // 체크포인트 정리
        await this.clearCheckpoint();
        
        // 강제 재구축 플래그 설정
        this.forceRebuildFlag = true;
        
        // 데이터 로드 및 임베딩
        await this.loadAndEmbedData();
        
        console.log('안전한 벡터DB 재구축 완료');
      } else {
        // 일반 초기화 (기존 데이터 유지)
        await this.initialize();
      }
    } catch (error) {
      console.error('벡터DB 재구축 실패:', error);
      
      // 백업에서 복구 시도
      const restored = await this.restoreFromBackup();
      if (restored) {
        console.log('백업에서 복구 완료');
      }
      
      throw error;
    } finally {
      // 플래그 초기화
      this.forceRebuildFlag = false;
    }
  }

  // 특정 타입의 문서들을 삭제하는 메서드
  public async deleteDocumentsByType(type: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(`${type} 타입 문서 삭제 시작...`);
      
      // 백업 생성
      await this.createBackup();
      
      // 현재 모든 아이템 조회
      const items = await this.index.listItems();
      console.log(`전체 아이템 수: ${items.length}`);
      
      // 삭제할 아이템들 찾기
      const itemsToDelete = items.filter(item => item.metadata?.type === type);
      console.log(`삭제 대상 ${type} 아이템 수: ${itemsToDelete.length}`);
      
      if (itemsToDelete.length === 0) {
        console.log(`삭제할 ${type} 타입 문서가 없습니다.`);
        return;
      }
      
      // 배치로 삭제 (인덱스 업데이트 시작)
      await this.index.beginUpdate();
      
      try {
        // 각 아이템 삭제
        for (const item of itemsToDelete) {
          await this.index.deleteItem(item.id);
        }
        
        // 인덱스 업데이트 완료
        await this.index.endUpdate();
        
        console.log(`${type} 타입 문서 ${itemsToDelete.length}건 삭제 완료`);
        
        // 삭제 후 통계 출력
        const remainingItems = await this.index.listItems();
        console.log(`삭제 후 남은 아이템 수: ${remainingItems.length}`);
        
        // 카테고리별 통계
        const categoryCount = { incident: 0, education: 0, regulation: 0 };
        for (const item of remainingItems) {
          const itemType = item.metadata?.type;
          if (itemType && categoryCount[itemType] !== undefined) {
            categoryCount[itemType]++;
          }
        }
        console.log('삭제 후 카테고리별 개수:', categoryCount);
        
      } catch (error) {
        // 업데이트 중 오류 발생 시 롤백
        await this.index.endUpdate();
        throw error;
      }
      
    } catch (error) {
      console.error(`${type} 타입 문서 삭제 실패:`, error);
      
      // 백업에서 복구 시도
      const restored = await this.restoreFromBackup();
      if (restored) {
        console.log('백업에서 복구 완료');
      }
      
      throw error;
    }
  }

  // 안전법규 데이터만 삭제하는 편의 메서드
  public async deleteRegulations(): Promise<void> {
    console.log('=== deleteRegulations() 시작 ===');
    await this.deleteDocumentsByType('regulation');
    console.log('=== deleteRegulations() 완료 ===');
  }

  // safety_rules.json 파일 임베딩 (AI 브리핑 최적화)
  public async embedSafetyRulesFile(): Promise<any> {
    try {
      console.log('=== safety_rules.json 임베딩 시작 ===');
      const regulationPath = './embed_data/safety_rules.json';
      
      // 파일 읽기
      let data;
      try {
        const fileContent = await fs.readFile(regulationPath, 'utf8');
        data = JSON.parse(fileContent);
        console.log('파일 읽기 성공');
      } catch (error) {
        console.error('파일 읽기 실패:', error);
        throw new Error('safety_rules.json 파일을 찾을 수 없거나 읽을 수 없습니다');
      }

      if (!this.isInitialized) {
        console.log('ChromaDB 초기화...');
        await this.initialize();
      }
      console.log(`안전법규 데이터 로드: ${data.articles?.length || 0}개 조항`);
      console.log(`문서 정보: ${data.document_title_ko} (${data.effective_date} 시행)`);

      if (!data.articles || data.articles.length === 0) {
        throw new Error('안전법규 조항이 없습니다');
      }

      // 백업 생성
      await this.createBackup();

      let processedCount = 0;

      // 각 조항을 임베딩 (AI 브리핑 최적화)
      for (let i = 0; i < data.articles.length; i++) {
        const article = data.articles[i];
        
        // 임베딩 생성 진행률 표시
        if (i % 50 === 0) {
          console.log(`안전법규 임베딩 진행: ${i}/${data.articles.length} (${Math.round(i/data.articles.length*100)}%)`);
        }

        try {
          // AI 브리핑에 최적화된 콘텐츠 구성
          const optimizedContent = [
            `제${article.article_number}조 ${article.article_korean_title}`,
            `법조번호: ${article.article_number}`,
            `조항명: ${article.article_korean_title}`,
            `법령내용: ${article.body}`,
            `적용범위: 산업안전보건기준규칙`,
            `시행일: ${data.effective_date}`
          ].join('\n');

          const embedding = await this.generateEmbedding(optimizedContent);

          // AI 브리핑용 메타데이터 구성
          const vectorItem = {
            id: `regulation_${article.article_number}`,
            vector: embedding,
            metadata: {
              type: 'regulation',
              title: `제${article.article_number}조 ${article.article_korean_title}`,
              article_number: article.article_number,
              article_title: article.article_korean_title,
              content: article.body,
              source_document: data.document_title_ko,
              effective_date: data.effective_date,
              regulation_category: this.categorizeRegulation(article.article_korean_title, article.body),
              search_keywords: this.extractRegulationKeywords(article.article_korean_title, article.body)
            }
          };

          await this.index.upsertItem(vectorItem);
          processedCount++;
          
          // 백업 생성 (100개 조항마다)
          if (i % 100 === 0 && i > 0) {
            await this.createBackup();
          }
          
        } catch (error) {
          console.error(`안전법규 조항 ${article.article_number} 임베딩 실패:`, error);
          continue;
        }
      }

      console.log(`안전법규 임베딩 완료: ${processedCount}/${data.articles.length}개 조항`);
      
      return {
        articlesProcessed: processedCount,
        totalArticles: data.articles.length,
        documentInfo: {
          title: data.document_title_ko,
          effectiveDate: data.effective_date,
          sourceFile: data.source_file
        }
      };
      
    } catch (error) {
      console.error('safety_rules.json 임베딩 실패:', error);
      throw error;
    }
  }

  // 안전법규 카테고리 분류 (AI 브리핑 최적화용)
  private categorizeRegulation(title: string, content: string): string {
    const text = `${title} ${content}`.toLowerCase();
    
    if (text.includes('전기') || text.includes('감전') || text.includes('충전부')) return '전기안전';
    if (text.includes('추락') || text.includes('비계') || text.includes('안전대')) return '추락방지';
    if (text.includes('화재') || text.includes('폭발') || text.includes('인화성')) return '화재폭발방지';
    if (text.includes('기계') || text.includes('설비') || text.includes('장치')) return '기계설비안전';
    if (text.includes('화학') || text.includes('유해물질') || text.includes('독성')) return '화학물질안전';
    if (text.includes('작업장') || text.includes('환경') || text.includes('위생')) return '작업환경';
    if (text.includes('보호구') || text.includes('안전모') || text.includes('안전화')) return '개인보호구';
    if (text.includes('크레인') || text.includes('리프트') || text.includes('운반')) return '운반하역';
    if (text.includes('용접') || text.includes('절단') || text.includes('가스')) return '용접절단';
    if (text.includes('건설') || text.includes('토목') || text.includes('굴착')) return '건설작업';
    
    return '일반안전';
  }

  // 안전법규 검색 키워드 추출 (AI 브리핑 최적화용)
  private extractRegulationKeywords(title: string, content: string): string {
    const text = `${title} ${content}`;
    const keywords: string[] = [];
    
    // 핵심 안전 키워드 추출
    const safetyTerms = [
      '안전', '위험', '방지', '보호', '예방', '조치', '점검', '관리', '설치', '착용',
      '전기', '감전', '추락', '화재', '폭발', '기계', '설비', '화학', '유해', '독성',
      '작업장', '근로자', '사업주', '비계', '안전대', '보호구', '안전모', '크레인',
      '용접', '절단', '건설', '굴착', '환기', '조명', '소음', '진동', '분진'
    ];
    
    safetyTerms.forEach(term => {
      if (text.includes(term)) {
        keywords.push(term);
      }
    });
    
    return keywords.join(', ');
  }

  // 새로운 안전법규 파일로 재임베딩하는 메서드
  public async reembedRegulations(newRegulationFile?: string): Promise<void> {
    try {
      console.log('안전법규 재임베딩 시작...');
      
      // 1. 기존 안전법규 데이터 삭제
      await this.deleteRegulations();
      
      // 2. 새로운 파일이 지정된 경우 해당 파일 사용, 아니면 기본 파일 사용
      const regulationFilePath = newRegulationFile || './embed_data/pdf_regulations_chunks.json';
      console.log(`새로운 안전법규 파일 경로: ${regulationFilePath}`);
      
      // 3. 새로운 데이터 로드
      let newRegulations: any[] = [];
      try {
        const regulationContent = await fs.readFile(regulationFilePath, 'utf-8');
        newRegulations = JSON.parse(regulationContent);
        console.log(`새로운 안전법규 데이터 ${newRegulations.length}건 로드`);
      } catch (error) {
        console.error(`안전법규 파일 로드 실패 (${regulationFilePath}):`, error);
        throw new Error(`안전법규 파일을 찾을 수 없습니다: ${regulationFilePath}`);
      }
      
      // 4. 새로운 데이터 임베딩 및 추가
      if (newRegulations.length > 0) {
        await this.processRegulations(newRegulations, 0);
        console.log(`새로운 안전법규 ${newRegulations.length}건 임베딩 완료`);
      }
      
      // 5. 최종 통계 출력
      const finalItems = await this.index.listItems();
      const categoryCount = { incident: 0, education: 0, regulation: 0 };
      for (const item of finalItems) {
        const type = item.metadata?.type;
        if (type && categoryCount[type] !== undefined) {
          categoryCount[type]++;
        }
      }
      
      console.log('안전법규 재임베딩 완료');
      console.log('최종 카테고리별 개수:', categoryCount);
      console.log(`전체 문서 수: ${finalItems.length}`);
      
    } catch (error) {
      console.error('안전법규 재임베딩 실패:', error);
      throw error;
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

      // 원본 데이터 파일 개수 확인
      const { accidentCases, educationData, pdfRegulations } = await this.loadAllData();
      const originalDataCounts = {
        '사고사례': accidentCases.length,
        '교육자료': educationData.length, 
        '안전법규': pdfRegulations.length
      };
      const totalOriginalDocuments = accidentCases.length + educationData.length + pdfRegulations.length;

      return {
        totalDocuments: totalOriginalDocuments,      // 원본 파일의 전체 문서수 (목표치)
        currentIndexedDocuments: items.length,       // 현재 인덱싱된 문서수 (실제값)
        originalDataCounts,                          // 각 카테고리별 원본 데이터 개수
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

  private async clearCheckpoint(): Promise<void> {
    try {
      await fs.unlink(this.checkpointPath);
      console.log('체크포인트 파일 삭제 완료');
    } catch (error) {
      // 파일이 없으면 무시
    }
  }

  // 교육자료만 선별적으로 제거
  async removeEducationData(): Promise<{ removed: number; remaining: number }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('교육자료 데이터 제거 시작...');

      // 백업 생성
      await this.createBackup();

      // 모든 아이템 조회
      const items = await this.index.listItems();
      console.log(`총 ${items.length}개 아이템 확인 중...`);

      let removedCount = 0;
      const itemsToRemove: string[] = [];

      // 교육자료 타입의 아이템 식별
      for (const item of items) {
        try {
          const fullItem = await this.index.getItem(item.id);
          if (fullItem?.metadata?.type === 'education') {
            itemsToRemove.push(item.id);
            removedCount++;
          }
        } catch (error) {
          console.warn(`아이템 ${item.id} 조회 실패:`, error);
        }
      }

      console.log(`제거할 교육자료: ${removedCount}개`);

      // 배치로 제거
      for (const itemId of itemsToRemove) {
        try {
          await this.index.deleteItem(itemId);
        } catch (error) {
          console.warn(`아이템 ${itemId} 제거 실패:`, error);
        }
      }

      // 남은 아이템 수 확인
      const remainingItems = await this.index.listItems();
      console.log(`교육자료 제거 완료: ${removedCount}개 제거, ${remainingItems.length}개 남음`);

      return {
        removed: removedCount,
        remaining: remainingItems.length
      };
    } catch (error) {
      console.error('교육자료 제거 실패:', error);
      throw error;
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
        const educationDataPath = path.join(process.cwd(), 'embed_data', 'education_data_filter.json');
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