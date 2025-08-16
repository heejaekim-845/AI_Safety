// safety_rules.json 임베딩 테스트
const fs = require('fs');

async function testEmbedSafetyRules() {
  console.log('=== safety_rules.json 임베딩 테스트 ===');
  
  // 파일 존재 확인
  const filePath = './embed_data/safety_rules.json';
  if (!fs.existsSync(filePath)) {
    console.error('파일이 존재하지 않습니다:', filePath);
    return;
  }
  
  // 파일 내용 확인
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
    }
    
    // API 호출 시도
    console.log('\nAPI 호출 테스트...');
    const fetch = require('node-fetch');
    
    const response = await fetch('http://localhost:5000/api/embed-safety-rules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const textResponse = await response.text();
    console.log('API 응답 상태:', response.status);
    console.log('응답 타입:', response.headers.get('content-type'));
    
    // JSON 응답인지 확인
    if (response.headers.get('content-type')?.includes('application/json')) {
      const result = JSON.parse(textResponse);
      console.log('API 응답:', result);
    } else {
      console.log('HTML 응답 받음 - 처음 100자:', textResponse.substring(0, 100));
    }
    
  } catch (error) {
    console.error('테스트 실패:', error.message);
  }
}

testEmbedSafetyRules();