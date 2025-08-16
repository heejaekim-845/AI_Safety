// 안전법규 삭제 테스트를 위한 단순 API 호출
const fetch = require('node-fetch');

async function testDeleteRegulations() {
  console.log('=== 안전법규 삭제 API 테스트 ===');
  
  try {
    const response = await fetch('http://localhost:5000/api/delete-regulations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('API 응답:', result);
    
  } catch (error) {
    console.error('API 호출 실패:', error);
  }
}

testDeleteRegulations();