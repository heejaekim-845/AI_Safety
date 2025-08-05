import json
import re
import pandas as pd
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

# -----------------------------
# 1. 파일 경로 설정
# -----------------------------
ACCIDENT_JSON = "accident_cases_for_rag.json"
EDUCATION_JSON = "education_data.json"
LAW_PDF = "산업안전보건기준.pdf"
CHROMA_DB_DIR = "safety_rag_db"

# -----------------------------
# 2. 사고사례 JSON 로드
# -----------------------------
with open(ACCIDENT_JSON, "r", encoding="utf-8") as f:
    accident_cases = json.load(f)

accident_docs = []
for case in accident_cases:
    content = (
        f"제목: {case['title']}\n"
        f"발생일자: {case['date']}\n"
        f"발생장소: {case['location']}\n"
        f"업종: {case['industry']}\n"
        f"작업유형: {case['work_type']}\n"
        f"재해형태: {case['accident_type']}\n"
        f"피해정도: {case['damage']}\n"
        f"사고개요: {case['summary']}\n"
        f"직접원인: {case['direct_cause']}\n"
        f"근본원인: {case['root_cause']}\n"
        f"위험요인 키워드: {case['risk_keywords']}\n"
        f"예방대책: {case['prevention']}"
    )
    accident_docs.append(Document(page_content=content, metadata={"type": "accident", "title": case["title"]}))

print(f"[INFO] 사고사례 로드 완료: {len(accident_docs)}건")

# -----------------------------
# 3. 교육자료 JSON 로드
# -----------------------------
with open(EDUCATION_JSON, "r", encoding="utf-8") as f:
    education_data = json.load(f)

edu_docs = []
for item in education_data:
    content = (
        f"제목: {item['title']}\n"
        f"작성일자: {item['date']}\n"
        f"발간번호: {item['doc_number']}\n"
        f"자료형태: {item['type']}\n"
        f"키워드: {item['keywords']}\n"
        f"내용: {item['content']}\n"
        f"URL: {item['url']}\n"
        f"첨부파일: {item['file_url']}"
    )
    edu_docs.append(Document(page_content=content, metadata={"type": "education", "title": item["title"]}))

print(f"[INFO] 교육자료 로드 완료: {len(edu_docs)}건")

# -----------------------------
# 4. 법령 PDF 로드
# -----------------------------
loader = PyPDFLoader(LAW_PDF)
documents = loader.load()

full_text = "\n".join([doc.page_content for doc in documents])
pattern = r"(제\d+조.*?)(?=제\d+조|\Z)"
matches = re.findall(pattern, full_text, re.DOTALL)

law_docs = []
for match in matches:
    header_line = match.split("\n")[0].strip()
    law_number = re.search(r"제(\d+)조", header_line)
    law_title = header_line

    metadata = {
        "type": "law",
        "law_number": law_number.group(1) if law_number else "",
        "title": law_title,
        "source": "산업안전보건기준"
    }
    law_docs.append(Document(page_content=match.strip(), metadata=metadata))

print(f"[INFO] 법령 로드 완료: {len(law_docs)}조")

# -----------------------------
# 5. 청킹
# -----------------------------
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)

accident_chunks = splitter.split_documents(accident_docs)
edu_chunks = splitter.split_documents(edu_docs)
law_chunks = splitter.split_documents(law_docs)

all_docs = accident_chunks + edu_chunks + law_chunks
print(f"[INFO] 전체 문서 청크 수: {len(all_docs)}")

# -----------------------------
# 6. ChromaDB 구축
# -----------------------------
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

vectorstore = Chroma.from_documents(
    documents=all_docs,
    embedding=embeddings,
    persist_directory=CHROMA_DB_DIR
)

vectorstore.persist()
print(f"[INFO] ChromaDB 구축 완료 → {CHROMA_DB_DIR}")
