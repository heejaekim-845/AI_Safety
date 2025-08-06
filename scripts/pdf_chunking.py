#!/usr/bin/env python3
"""
PDF 청킹 스크립트 - LangChain의 PyPDFLoader와 TextSplitter 사용
"""

import json
import sys
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

def chunk_pdf(pdf_path: str, output_path: str):
    """PDF 파일을 청킹하여 JSON으로 저장"""
    try:
        # PDF 로드
        print(f"PDF 파일 로드 중: {pdf_path}")
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()
        
        print(f"PDF 페이지 수: {len(documents)}")
        
        # 텍스트 분할기 설정
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,  # 청크 크기
            chunk_overlap=100,  # 중복 크기
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        # 문서 분할
        chunked_docs = text_splitter.split_documents(documents)
        print(f"총 청크 개수: {len(chunked_docs)}")
        
        # JSON 형태로 변환
        chunks = []
        for i, chunk in enumerate(chunked_docs):
            chunks.append({
                "chunk_id": i,
                "page_number": chunk.metadata.get("page", 0),
                "source": chunk.metadata.get("source", ""),
                "content": chunk.page_content,
                "title": f"산업안전보건기준에 관한 규칙 - 청크 {i + 1}",
                "category": "산업안전보건법규",
                "type": "regulation"
            })
        
        # JSON 파일로 저장
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(chunks, f, ensure_ascii=False, indent=2)
        
        print(f"청킹 완료: {output_path}")
        print(f"총 {len(chunks)}개 청크 생성")
        
        return len(chunks)
        
    except Exception as e:
        print(f"PDF 청킹 오류: {e}")
        return 0

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("사용법: python pdf_chunking.py <pdf_path> <output_json_path>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    
    chunk_count = chunk_pdf(pdf_path, output_path)
    print(f"완료: {chunk_count}개 청크")