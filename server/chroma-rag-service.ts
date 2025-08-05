// ChromaDB를 사용한 고급 RAG 시스템 (ChromaDB 서버가 실행 중일 때만 활성화)
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

interface AccidentCase {
  title: string;
  date: string;
  location: string;
  industry: string;
  work_type: string;
  accident_type: string;
  damage: string;
  summary: string;
  direct_cause: string;
  root_cause: string;
  risk_keywords: string;
  prevention: string;
}

interface EducationData {
  title: string;
  date: string;
  doc_number: string;
  type: string;
  keywords: string;
  content: string;
  url: string;
  file_url: string;
}

interface SafetyRegulation {
  title: string;
  article_number: string;
  content: string;
  category: string;
}

export class ChromaRAGService {
  private openai: OpenAI;
  private accidentData: AccidentCase[] = [];
  private educationData: EducationData[] = [];
  private regulationData: SafetyRegulation[] = [];
  private isInitialized = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Enhanced RAG Service 초기화 시작...');
      
      // JSON 파일들에서 데이터 로드
      await this.loadInitialData();
      
      this.isInitialized = true;
      console.log('Enhanced RAG Service 초기화 완료');
    } catch (error) {
      console.error('Enhanced RAG Service 초기화 실패:', error);
      this.isInitialized = true;
    }
  }

  private async loadInitialData(): Promise<void> {
    try {
      // 사고사례 데이터 로드
      const accidentDataPath = path.join(process.cwd(), 'data', 'accident_cases_for_rag.json');
      if (fs.existsSync(accidentDataPath)) {
        this.accidentData = JSON.parse(fs.readFileSync(accidentDataPath, 'utf-8'));
        console.log(`사고사례 ${this.accidentData.length}건 로드 완료`);
      }

      // 교육자료 데이터 로드
      const educationDataPath = path.join(process.cwd(), 'data', 'education_data.json');
      if (fs.existsSync(educationDataPath)) {
        this.educationData = JSON.parse(fs.readFileSync(educationDataPath, 'utf-8'));
        console.log(`교육자료 ${this.educationData.length}건 로드 완료`);
      }

      // 안전보건 법규 데이터 추가 - 전기설비 중심으로 확장
      this.regulationData = [
        // 전기설비 안전 관련 조항들 (170kV GIS 등 고압 전기설비) - 원문 기준
        {
          title: "제301조(전기기계·기구의 방호)",
          article_number: "제301조",
          content: "사업주는 근로자가 전기에 의하여 위험을 입을 우려가 있는 장소에 전기기계·기구를 설치하는 경우에는 충전부가 노출되지 아니하도록 폐쇄형 구조로 하거나 절연덮개 등 적절한 방호장치를 설치하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제302조(접지)",
          article_number: "제302조",
          content: "사업주는 전기기계·기구의 충전될 우려가 있는 금속제 외함에 대하여는 접지선을 연결하는 등의 조치를 하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제303조(누전차단기)",
          article_number: "제303조",
          content: "사업주는 전기기계·기구를 습기가 많은 장소에서 사용하거나 근로자가 전기에 의한 위험에 노출될 우려가 있는 장소에서는 누전차단기를 설치하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제304조(과전류차단장치)",
          article_number: "제304조",
          content: "사업주는 전기설비에 과전류가 흘러 화재의 위험이 있는 경우에는 과전류차단장치를 설치하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제305조(전기기계의 조작)",
          article_number: "제305조",
          content: "사업주는 전기기계를 조작하는 경우에는 해당 전기기계에 전력을 공급하는 개폐기에 잠금장치를 하고 그 개폐기에 작업 중임을 표시하는 꼬리표를 붙이는 등의 조치를 하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제306조(전기기계·기구의 조작 시 위험방지)",
          article_number: "제306조",
          content: "사업주는 전기기계·기구를 조작하는 근로자에 대하여 해당 기계·기구의 충전부, 회전부 등에 접촉하지 아니하도록 하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제307조(배전반 등의 방호)",
          article_number: "제307조",
          content: "사업주는 배전반, 배전함, 개폐기함 등 전기설비를 설치하는 경우에는 충전부에 근로자가 접촉하거나 접근할 우려가 없도록 적절한 방호장치를 설치하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제308조(전기설비 설치 시 안전조치)",
          article_number: "제308조",
          content: "사업주는 전기설비를 설치하는 경우에는 감전, 화재 등의 위험을 방지하기 위하여 전기사업법에 따른 전기설비기술기준에 적합하게 설치하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제309조(전기기계·기구의 수리 등)",
          article_number: "제309조",
          content: "사업주는 전기기계·기구를 수리하거나 청소하는 경우에는 해당 기계·기구의 전원을 차단하고 해당 개폐기에 잠금장치를 하는 등 감전을 방지하기 위하여 필요한 조치를 하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제310조(이동전선의 방호)",
          article_number: "제310조",
          content: "사업주는 이동전선이 날카로운 모서리, 열, 기름, 화학물질 등에 의하여 손상되지 아니하도록 보호하여야 한다.",
          category: "전기안전"
        },
        {
          title: "제318조(전기작업자의 제한)",
          article_number: "제318조",
          content: "사업주는 고압 또는 특고압 전기설비의 설치·정비·점검 등의 업무를 하는 근로자에 대하여는 다음 각 호의 어느 하나에 해당하는 자로 하여금 작업하게 하여야 한다. 1. 전기기사 이상의 자격을 취득한 자 2. 전기산업기사의 자격을 취득한 자로서 3년 이상의 실무경험이 있는 자 3. 전기기능사의 자격을 취득한 자로서 5년 이상의 실무경험이 있는 자 4. 해당 업무에 관한 안전보건교육을 이수한 자로서 3년 이상의 실무경험이 있는 자",
          category: "전기작업자격"
        },
        {
          title: "제319조(정전작업)",
          article_number: "제319조",
          content: "사업주는 충전된 전로에서 작업을 하는 경우에는 전원을 차단하고, 그 개폐기에 잠금장치를 하며, 작업 중임을 표시하는 꼬리표를 붙이는 등의 조치를 하여야 한다.",
          category: "전기작업절차"
        },
        {
          title: "제320조(충전전로에서의 작업)",
          article_number: "제320조",
          content: "사업주는 충전된 전로에서 작업을 하는 경우에는 절연용 보호구나 절연용 방호구를 착용하게 하거나 활선작업용 장치 및 기구를 사용하게 하여야 한다.",
          category: "전기작업절차"
        },
        {
          title: "제321조(접지)",
          article_number: "제321조",
          content: "사업주는 전로의 개폐기를 열어 전원을 차단한 후 작업을 하는 경우에는 작업개시 전에 검전기를 사용하여 무전압을 확인하고, 해당 전로에 접지를 하여야 한다.",
          category: "전기작업절차"
        },
        {
          title: "제322조(충전전로 인근작업)",
          article_number: "제322조",
          content: "사업주는 충전된 전로 인근에서 작업을 하는 경우에는 방호울타리를 설치하거나 감시인을 배치하는 등 위험을 방지하기 위하여 필요한 조치를 하여야 한다.",
          category: "전기작업절차"
        },
        {
          title: "제323조(절연용 보호구의 점검 등)",
          article_number: "제323조",
          content: "① 사업주는 절연용 보호구, 절연용 방호구, 활선작업용 장치 및 기구를 사용하는 경우에는 그 절연성능을 점검한 후 사용하게 하여야 한다. ② 사업주는 제1항에 따른 절연용 보호구 등에 대하여 다음 각 호의 사항을 점검하여야 한다. 1. 외관의 손상 또는 오손 여부 2. 절연성능의 이상 유무 3. 기타 이상 유무",
          category: "전기보호구"
        },
        // 기존 일반 안전 조항들 - 원문 기준
        {
          title: "제3조(전도의 방지)",
          article_number: "제3조",
          content: "사업주는 근로자가 작업장에서 넘어지거나 미끄러지는 등의 위험이 없도록 작업장 바닥면을 안전하고 청결한 상태로 유지하여야 한다.",
          category: "작업장 안전"
        },
        {
          title: "제13조(안전난간의 구조 및 설치요건)",
          article_number: "제13조",
          content: "사업주는 근로자의 추락 등의 위험을 방지하기 위하여 안전난간을 설치하는 경우에는 다음 각 호의 기준에 적합하게 설치하여야 한다. 1. 상부난간대, 중간난간대, 발끝막이판 및 난간기둥으로 구성할 것 2. 상부난간대는 바닥면·발판 또는 경사로의 표면으로부터 90센티미터 이상 120센티미터 이하의 지점에 설치할 것",
          category: "추락방지"
        },
        {
          title: "제14조(낙하물에 의한 위험의 방지)",
          article_number: "제14조",
          content: "사업주는 작업장의 바닥면, 도로 및 통로 등에서 낙하물이 근로자에게 위험을 미칠 우려가 있는 경우에는 보호망 또는 수직보호망을 설치하는 등 필요한 조치를 하여야 한다.",
          category: "낙하물 방지"
        },
        {
          title: "제8조(조도)",
          article_number: "제8조",
          content: "사업주는 근로자가 상시 작업하는 장소의 작업면 조도를 다음 각 호의 기준에 적합하게 유지하여야 한다. 1. 정밀작업: 300럭스 이상 2. 보통작업: 150럭스 이상 3. 기타작업: 75럭스 이상",
          category: "작업환경"
        }
      ];

      console.log(`법규 ${this.regulationData.length}건 로드 완료`);

    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
    }
  }

  // Simplified RAG uses keyword-based search instead of embeddings
  // This method is kept for potential future ChromaDB integration

  async searchRelevantAccidents(workType: string, equipmentName: string, riskFactors: string[], limit: number = 3): Promise<AccidentCase[]> {
    await this.initialize();

    try {
      // 키워드 기반 검색으로 관련 사고사례 찾기
      const searchTerms = [
        workType.toLowerCase(),
        equipmentName.toLowerCase(),
        ...riskFactors.map(rf => rf.toLowerCase())
      ].filter(term => term && term.trim().length > 0);

      // 추가 키워드 확장
      const expandedTerms = [...searchTerms];
      if (equipmentName.toLowerCase().includes('gis')) {
        expandedTerms.push('변전소', '전기', '고전압', '감전', '절연');
      }
      if (workType.toLowerCase().includes('정비') || workType.toLowerCase().includes('점검')) {
        expandedTerms.push('정비', '점검', '수리', '보수');
      }
      if (workType.toLowerCase().includes('컨베이어')) {
        expandedTerms.push('벨트', '끼임', '회전');
      }

      const relevantAccidents = this.accidentData.filter(accident => {
        const searchText = `${accident.title} ${accident.work_type} ${accident.accident_type} ${accident.summary} ${accident.risk_keywords}`.toLowerCase();
        
        return expandedTerms.some(term => 
          term && searchText.includes(term)
        );
      });

      // 관련도 점수 계산 (키워드 매칭 수 기준)
      const scoredAccidents = relevantAccidents.map(accident => {
        const searchText = `${accident.title} ${accident.work_type} ${accident.accident_type} ${accident.summary} ${accident.risk_keywords}`.toLowerCase();
        const score = searchTerms.filter(term => 
          term && searchText.includes(term)
        ).length;
        
        return { accident, score };
      });

      // 점수순으로 정렬하고 limit만큼 반환
      return scoredAccidents
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.accident);

    } catch (error) {
      console.error('사고사례 검색 실패:', error);
      return [];
    }
  }

  async searchSafetyRegulations(equipmentName: string, workType: string, riskFactors: string[] = [], limit: number = 5): Promise<SafetyRegulation[]> {
    await this.initialize();

    try {
      // 복합 검색어 구성
      const queryTerms = [
        equipmentName.toLowerCase(),
        workType.toLowerCase(),
        ...riskFactors.map(rf => rf.toLowerCase())
      ].filter(term => term && term.trim().length > 0);
      
      // 장비별 특화 키워드 확장
      const expandedTerms = [...queryTerms];
      
      // 170kV GIS, 변전설비, 전기설비 관련
      if (equipmentName.toLowerCase().includes('gis') || 
          equipmentName.toLowerCase().includes('변전') || 
          equipmentName.toLowerCase().includes('전기') ||
          equipmentName.toLowerCase().includes('kv') ||
          riskFactors.some(rf => rf.toLowerCase().includes('전기') || rf.toLowerCase().includes('고전압'))) {
        expandedTerms.push(
          '전기', '감전', '절연', '정전', '충전', '전로', '접지', 
          '누전', '과전류', '방호', '차단', '검전', '무전압',
          '절연용', '보호구', '활선', '방호울타리', '감시인', '자격'
        );
      }
      
      // 정비/점검 작업 관련
      if (workType.toLowerCase().includes('정비') || 
          workType.toLowerCase().includes('점검') || 
          workType.toLowerCase().includes('수리')) {
        expandedTerms.push('정비', '점검', '수리', '보수', '작업자', '자격', '교육');
      }
      
      // 고소작업 관련
      if (workType.toLowerCase().includes('고소') || 
          riskFactors.some(rf => rf.toLowerCase().includes('추락'))) {
        expandedTerms.push('추락', '난간', '안전대', '발판');
      }
      
      // 컨베이어/기계 관련
      if (equipmentName.toLowerCase().includes('컨베이어') || 
          equipmentName.toLowerCase().includes('기계')) {
        expandedTerms.push('끼임', '방호', '전원', '차단', '기계');
      }
      
      // 관련도 점수 계산으로 검색 개선
      const scoredRegulations = this.regulationData.map(regulation => {
        const searchText = `${regulation.title} ${regulation.content} ${regulation.category}`.toLowerCase();
        
        // 정확한 매칭에 높은 점수
        let score = 0;
        expandedTerms.forEach(term => {
          if (term && searchText.includes(term)) {
            // 제목에 포함된 경우 더 높은 점수
            if (regulation.title.toLowerCase().includes(term)) {
              score += 3;
            }
            // 카테고리에 포함된 경우 중간 점수
            else if (regulation.category.toLowerCase().includes(term)) {
              score += 2;
            }
            // 내용에 포함된 경우 기본 점수
            else {
              score += 1;
            }
          }
        });
        
        return { regulation, score };
      });
      
      // 점수순으로 정렬하고 최소 점수 1 이상인 것들만 반환
      return scoredRegulations
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.regulation);

    } catch (error) {
      console.error('법규 검색 실패:', error);
      return [];
    }
  }

  async searchEducationMaterials(query: string, limit: number = 3): Promise<EducationData[]> {
    await this.initialize();

    try {
      const queryLower = query.toLowerCase();
      
      // 키워드 확장
      const expandedTerms = queryLower.split(' ').filter(term => term.trim().length > 0);
      if (queryLower.includes('gis') || queryLower.includes('전기')) {
        expandedTerms.push('전기안전', '감전방지', '절연');
      }
      if (queryLower.includes('안전교육') || queryLower.includes('교육')) {
        expandedTerms.push('교육', '훈련', '안전', '예방');
      }
      
      const relevantEducation = this.educationData.filter(edu => {
        const searchText = `${edu.title} ${edu.keywords} ${edu.content} ${edu.type}`.toLowerCase();
        return expandedTerms.some(term => searchText.includes(term));
      });

      return relevantEducation.slice(0, limit);

    } catch (error) {
      console.error('교육자료 검색 실패:', error);
      return [];
    }
  }

  private extractFromDocument(document: string, field: string): string {
    const lines = document.split('\n');
    const fieldLine = lines.find(line => line.startsWith(`${field}:`));
    return fieldLine ? fieldLine.substring(field.length + 1).trim() : '';
  }

  async getAccidentsByWorkType(workType: string, limit: number = 5): Promise<AccidentCase[]> {
    await this.initialize();

    try {
      const workTypeLower = workType.toLowerCase();
      
      const relevantAccidents = this.accidentData.filter(accident => {
        return accident.work_type.toLowerCase().includes(workTypeLower) ||
               accident.title.toLowerCase().includes(workTypeLower);
      });

      return relevantAccidents.slice(0, limit);

    } catch (error) {
      console.error('작업유형별 사고사례 검색 실패:', error);
      return [];
    }
  }
}

export const chromaRAGService = new ChromaRAGService();