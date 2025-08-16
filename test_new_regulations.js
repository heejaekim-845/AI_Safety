// 새로 추가된 안전법규 테스트
import { LocalIndex } from 'vectra';
import OpenAI from 'openai';

class RegulationTester {
  constructor() {
    this.index = new LocalIndex('./data/vectra-index');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });
  }

  async generateEmbedding(text) {
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

  async testRegulations() {
    try {
      console.log('=== 안전법규 데이터 확인 ===');
      
      // 전체 아이템 수 확인
      const allItems = await this.index.listItems();
      console.log(`전체 벡터 아이템 수: ${allItems.length}`);
      
      // regulation 타입 아이템 수 확인
      const regulationItems = allItems.filter(item => item.metadata?.type === 'regulation');
      console.log(`안전법규 아이템 수: ${regulationItems.length}`);
      
      if (regulationItems.length > 0) {
        console.log(`\n처음 5개 안전법규:`);
        for (let i = 0; i < Math.min(5, regulationItems.length); i++) {
          const item = regulationItems[i];
          console.log(`${i+1}. ${item.metadata.title} (카테고리: ${item.metadata.regulation_category})`);
        }
        
        // 전기 관련 안전법규 검색 테스트
        console.log(`\n=== 전기 안전 검색 테스트 ===`);
        const queryEmbedding = await this.generateEmbedding('전기 안전 점검 감전 방지');
        const searchResults = await this.index.queryItems(queryEmbedding, 5);
        
        console.log(`검색 결과 (상위 5개):`);
        searchResults.forEach((result, index) => {
          if (result.item.metadata?.type === 'regulation') {
            console.log(`${index+1}. [법규] ${result.item.metadata.title} (유사도: ${(1-result.score).toFixed(3)})`);
            console.log(`   카테고리: ${result.item.metadata.regulation_category}`);
            console.log(`   키워드: ${result.item.metadata.search_keywords}`);
          } else {
            console.log(`${index+1}. [${result.item.metadata?.type || '기타'}] ${result.item.metadata?.title || 'N/A'} (유사도: ${(1-result.score).toFixed(3)})`);
          }
        });
        
        return {
          totalItems: allItems.length,
          regulationItems: regulationItems.length,
          electricalSafetyResults: searchResults.length
        };
      }
      
    } catch (error) {
      console.error('테스트 실패:', error);
      throw error;
    }
  }
}

async function main() {
  const tester = new RegulationTester();
  
  try {
    const result = await tester.testRegulations();
    console.log('\n테스트 완료:', result);
  } catch (error) {
    console.error('테스트 스크립트 실행 실패:', error);
  }
}

main();