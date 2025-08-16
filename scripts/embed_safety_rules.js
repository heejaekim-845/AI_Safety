// safety_rules.json 임베딩 스크립트
import { LocalIndex } from 'vectra';
import OpenAI from 'openai';
import fs from 'fs/promises';

class SafetyRulesEmbedder {
  constructor() {
    this.index = new LocalIndex('./data/vectra-index');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });
  }

  async initialize() {
    if (!await this.index.isIndexCreated()) {
      console.log('벡터 인덱스 생성 중...');
      await this.index.createIndex();
    }
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

  categorizeRegulation(title, content) {
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

  extractRegulationKeywords(title, content) {
    const text = `${title} ${content}`;
    const keywords = [];
    
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

  async deleteRegulations() {
    console.log('기존 안전법규 데이터 삭제 중...');
    await this.index.beginUpdate();
    
    try {
      const allItems = await this.index.listItems();
      let deletedCount = 0;
      
      for (const item of allItems) {
        if (item.metadata?.type === 'regulation') {
          await this.index.deleteItem(item.id);
          deletedCount++;
        }
      }
      
      await this.index.endUpdate();
      console.log(`기존 안전법규 ${deletedCount}개 삭제 완료`);
      
    } catch (error) {
      await this.index.endUpdate();
      throw error;
    }
  }

  async embedSafetyRules() {
    try {
      console.log('=== safety_rules.json 임베딩 시작 ===');
      
      // 초기화
      await this.initialize();
      
      // 파일 읽기
      const fileContent = await fs.readFile('./embed_data/safety_rules.json', 'utf8');
      const data = JSON.parse(fileContent);
      
      console.log(`문서 제목: ${data.document_title_ko}`);
      console.log(`시행일: ${data.effective_date}`);
      console.log(`총 조항 수: ${data.total_articles}`);
      console.log(`실제 조항 배열 길이: ${data.articles?.length || 0}`);
      
      if (!data.articles || data.articles.length === 0) {
        throw new Error('안전법규 조항이 없습니다');
      }

      // 기존 regulation 데이터 삭제
      await this.deleteRegulations();
      
      // 업데이트 시작
      await this.index.beginUpdate();
      
      let processedCount = 0;
      
      try {
        // 각 조항을 임베딩
        for (let i = 0; i < data.articles.length; i++) {
          const article = data.articles[i];
          
          // 진행률 표시
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
            
          } catch (error) {
            console.error(`안전법규 조항 ${article.article_number} 임베딩 실패:`, error);
            continue;
          }
        }
        
        await this.index.endUpdate();
        
      } catch (error) {
        await this.index.endUpdate();
        throw error;
      }

      console.log(`\n=== 안전법규 임베딩 완료 ===`);
      console.log(`처리된 조항: ${processedCount}/${data.articles.length}개`);
      console.log(`문서 정보: ${data.document_title_ko} (${data.effective_date} 시행)`);
      
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
}

// 스크립트 실행
async function main() {
  const embedder = new SafetyRulesEmbedder();
  
  try {
    const result = await embedder.embedSafetyRules();
    console.log('\n임베딩 결과:', result);
    process.exit(0);
  } catch (error) {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  }
}

main();