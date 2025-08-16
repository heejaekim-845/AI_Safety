// Node.js에서 CommonJS 모드로 테스트
import fs from 'fs/promises';

async function testSafetyRules() {
  try {
    console.log('safety_rules.json 파일 테스트 시작...');
    
    const fileContent = await fs.readFile('./embed_data/safety_rules.json', 'utf8');
    const data = JSON.parse(fileContent);
    
    console.log(`문서 제목: ${data.document_title_ko}`);
    console.log(`시행일: ${data.effective_date}`);
    console.log(`총 조항 수: ${data.total_articles}`);
    console.log(`실제 조항 배열 길이: ${data.articles?.length || 0}`);
    
    if (data.articles && data.articles.length > 0) {
      console.log('첫 번째 조항:', {
        번호: data.articles[0].article_number,
        제목: data.articles[0].article_korean_title,
        내용길이: data.articles[0].body?.length || 0
      });
      
      // 처음 3개 조항 테스트
      console.log('\n처음 3개 조항:');
      for (let i = 0; i < Math.min(3, data.articles.length); i++) {
        const article = data.articles[i];
        console.log(`${i+1}. 제${article.article_number}조: ${article.article_korean_title}`);
      }
    }
    
  } catch (error) {
    console.error('파일 테스트 실패:', error.message);
  }
}

testSafetyRules();