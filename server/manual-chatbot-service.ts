import { LocalIndex } from 'vectra';
import { OpenAI } from 'openai';
import path from 'path';
import fs from 'fs/promises';

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

  constructor() {
    this.index = new LocalIndex(this.indexPath);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('매뉴얼 챗봇 서비스 초기화 중...');

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다.');
      }

      // 매뉴얼 임베딩 파일 확인
      const embeddingFile = './chatbot/codes/manual_chunks/merged/embeddings.ndjson';
      try {
        await fs.access(embeddingFile);
        console.log('매뉴얼 임베딩 파일 발견:', embeddingFile);
      } catch {
        throw new Error(`매뉴얼 임베딩 파일을 찾을 수 없습니다: ${embeddingFile}`);
      }

      // OpenAI 연결 테스트
      await this.openai.models.list();
      
      this.isInitialized = true;
      console.log('매뉴얼 챗봇 서비스 초기화 완료');
    } catch (error) {
      console.error('매뉴얼 챗봇 서비스 초기화 실패:', error);
      throw error;
    }
  }

  async searchManualContent(query: string, equipmentFilter?: string[], familyFilter?: string, limit: number = 5): Promise<ManualChunk[]> {
    await this.initialize();

    try {
      // 질의 임베딩 생성
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      
      const queryVector = embeddingResponse.data[0].embedding;

      // 매뉴얼 임베딩 파일에서 직접 검색
      const embeddingFile = './chatbot/codes/manual_chunks/merged/embeddings.ndjson';
      const fileContent = await fs.readFile(embeddingFile, 'utf-8');
      const lines = fileContent.trim().split('\n');
      
      const similarities: { chunk: any; score: number }[] = [];
      
      for (const line of lines) {
        try {
          const chunk = JSON.parse(line);
          if (!chunk.embedding || !Array.isArray(chunk.embedding)) continue;
          
          // 코사인 유사도 계산
          const score = this.cosineSimilarity(queryVector, chunk.embedding);
          similarities.push({ chunk, score });
        } catch (error) {
          continue; // 파싱 오류 무시
        }
      }

      // 유사도 기준 정렬
      similarities.sort((a, b) => b.score - a.score);

      // 결과 필터링 및 변환
      const chunks: ManualChunk[] = [];
      
      for (const { chunk, score } of similarities) {
        const metadata = chunk.metadata || {};
        
        // 설비 필터링
        if (equipmentFilter && equipmentFilter.length > 0) {
          const hasMatchingEquipment = equipmentFilter.some(eq => 
            Array.isArray(metadata.equipment) && metadata.equipment.includes(eq)
          );
          if (!hasMatchingEquipment) continue;
        }

        // 패밀리 필터링
        if (familyFilter && metadata.family !== familyFilter) {
          continue;
        }

        chunks.push({
          id: chunk.id || `chunk_${Date.now()}_${Math.random()}`,
          text: chunk.text || '',
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
          score
        });

        if (chunks.length >= limit) break;
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
      // 매뉴얼 임베딩 파일에서 메타데이터 수집
      const embeddingFile = './chatbot/codes/manual_chunks/merged/embeddings.ndjson';
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