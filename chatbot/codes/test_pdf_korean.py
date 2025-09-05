#!/usr/bin/env python3
"""
한글 PDF 텍스트 추출 테스트 스크립트
"""
import sys
from pypdf import PdfReader
from io import StringIO

def test_pypdf_extraction(pdf_path):
    print(f"Testing PDF: {pdf_path}")
    
    try:
        with open(pdf_path, 'rb') as file:
            reader = PdfReader(file)
            
            # 첫 몇 페이지의 텍스트 추출
            for i in range(min(3, len(reader.pages))):
                page = reader.pages[i]
                text = page.extract_text()
                print(f"\n=== Page {i+1} ===")
                print(f"Text length: {len(text)}")
                if text:
                    # 첫 200자만 출력
                    print(f"Sample text: {repr(text[:200])}")
                    
                    # 한글이 있는지 확인
                    korean_chars = [c for c in text if '\uAC00' <= c <= '\uD7A3']
                    print(f"Korean characters found: {len(korean_chars)}")
                    if korean_chars:
                        print(f"Sample Korean: {''.join(korean_chars[:20])}")
                else:
                    print("No text extracted")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_pypdf_extraction(sys.argv[1])
    else:
        # 기본 테스트
        test_pypdf_extraction("../manuals/보조여수로 수문설비.pdf")