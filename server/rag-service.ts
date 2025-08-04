// RAG Service for Safety Briefings
// This service will handle vector storage and retrieval of regulations, incidents, and education materials

interface RegulationDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  applicableEquipment: string[];
  lastUpdated: Date;
}

interface IncidentRecord {
  id: string;
  title: string;
  description: string;
  equipmentType: string;
  workType: string;
  severity: string;
  rootCause: string;
  preventiveMeasures: string[];
  date: Date;
}

interface EducationMaterial {
  id: string;
  title: string;
  content: string;
  type: 'video' | 'document' | 'presentation';
  category: string;
  equipmentTypes: string[];
  workTypes: string[];
  url?: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
}

export class RAGService {
  private regulations: RegulationDocument[] = [];
  private incidents: IncidentRecord[] = [];
  private educationMaterials: EducationMaterial[] = [];
  private quizQuestions: QuizQuestion[] = [];

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample regulations
    this.regulations = [
      {
        id: 'reg-001',
        title: '산업안전보건법 제38조 (안전보건관리책임자 등의 의무)',
        content: '안전보건관리책임자는 사업장의 안전보건관리업무를 총괄하여 관리하여야 하며, 근로자의 안전과 보건을 확보하기 위한 조치를 강구하여야 한다.',
        category: '법령',
        applicableEquipment: ['압축기', '용접기', '컨베이어'],
        lastUpdated: new Date('2024-01-15')
      },
      {
        id: 'reg-002',
        title: 'KOSHA GUIDE G-7-2012 (압축공기 사용 안전지침)',
        content: '압축공기를 사용하는 작업에서는 압력계를 정기적으로 점검하고, 안전밸브의 작동상태를 확인하여야 한다.',
        category: '지침',
        applicableEquipment: ['압축기'],
        lastUpdated: new Date('2024-02-10')
      },
      {
        id: 'reg-003',
        title: '용접작업 안전수칙 (KOSHA GUIDE W-16-2020)',
        content: '용접작업 시에는 적절한 환기시설을 설치하고, 방화복 및 용접마스크를 착용하여야 한다.',
        category: '지침',
        applicableEquipment: ['용접기'],
        lastUpdated: new Date('2024-01-20')
      }
    ];

    // Sample incident records
    this.incidents = [
      {
        id: 'inc-001',
        title: '압축기 과압으로 인한 배관 파열 사고',
        description: '정기점검 미실시로 인한 압력 조절 밸브 오작동으로 과압 발생, 배관 연결부 파열',
        equipmentType: '압축기',
        workType: '정기 점검',
        severity: 'HIGH',
        rootCause: '정기점검 누락, 압력조절밸브 점검 미실시',
        preventiveMeasures: [
          '월 1회 이상 압력계 점검 실시',
          '안전밸브 작동 상태 정기 확인',
          '작업 전 LOTO 절차 철저히 이행'
        ],
        date: new Date('2024-01-10')
      },
      {
        id: 'inc-002',
        title: '컨베이어 벨트 끼임 사고',
        description: '운전 중인 컨베이어에 이물질 제거 작업 중 작업자 손가락 끼임',
        equipmentType: '컨베이어',
        workType: '청소 및 점검',
        severity: 'MEDIUM',
        rootCause: '정지 절차 미준수, 안전장치 해제',
        preventiveMeasures: [
          '작업 전 반드시 설비 정지',
          'LOTO 절차 준수',
          '적절한 작업도구 사용'
        ],
        date: new Date('2024-02-05')
      },
      {
        id: 'inc-003',
        title: '용접 작업 중 화재 발생',
        description: '용접 스패터가 주변 가연물에 떨어져 화재 발생',
        equipmentType: '용접기',
        workType: '용접 작업',
        severity: 'HIGH',
        rootCause: '작업 구역 정리 미흡, 방화포 미설치',
        preventiveMeasures: [
          '작업 전 주변 가연물 제거',
          '방화포 설치',
          '소화기 비치 및 감시자 배치'
        ],
        date: new Date('2024-01-25')
      }
    ];

    // Sample education materials
    this.educationMaterials = [
      {
        id: 'edu-001',
        title: '압축기 안전 운전 매뉴얼',
        content: '압축기의 기본 구조, 안전 운전 방법, 정기점검 항목에 대한 상세 교육자료',
        type: 'document',
        category: '운전매뉴얼',
        equipmentTypes: ['압축기'],
        workTypes: ['정기 점검', '안전 정지'],
        url: '/education/compressor-manual.pdf'
      },
      {
        id: 'edu-002',
        title: 'LOTO 절차 교육 영상',
        content: '잠금/태그아웃 절차의 올바른 실행 방법에 대한 동영상 교육자료',
        type: 'video',
        category: '안전절차',
        equipmentTypes: ['압축기', '컨베이어', '용접기'],
        workTypes: ['정기 점검', '안전 정지', '청소 및 점검'],
        url: '/education/loto-procedure.mp4'
      },
      {
        id: 'edu-003',
        title: '용접 안전 가이드',
        content: '용접작업의 안전수칙, 보호구 착용법, 화재 예방 방법',
        type: 'presentation',
        category: '작업안전',
        equipmentTypes: ['용접기'],
        workTypes: ['용접 작업'],
        url: '/education/welding-safety.pptx'
      }
    ];

    // Sample quiz questions
    this.quizQuestions = [
      {
        id: 'quiz-001',
        question: '압축기 작업 전 반드시 확인해야 할 가장 중요한 안전 사항은?',
        options: [
          '윤활유 보충',
          '전원 차단 및 LOTO 적용',
          '청소 도구 준비',
          '작업 일지 작성'
        ],
        correctAnswer: 1,
        explanation: '모든 설비 작업 전에는 반드시 전원을 차단하고 잠금/태그아웃(LOTO) 절차를 적용하여 예기치 못한 기동을 방지해야 합니다.',
        category: '안전절차'
      },
      {
        id: 'quiz-002',
        question: '압축기의 압력이 비정상적으로 높을 때 가장 먼저 해야 할 조치는?',
        options: [
          '계속 운전하면서 관찰',
          '즉시 압축기 정지',
          '압력계만 교체',
          '관리자에게만 보고'
        ],
        correctAnswer: 1,
        explanation: '비정상적인 고압은 폭발 등 심각한 사고로 이어질 수 있으므로 즉시 압축기를 정지시켜야 합니다.',
        category: '비상대응'
      },
      {
        id: 'quiz-003',
        question: '컨베이어 벨트 점검 시 착용해야 할 기본 보호구는?',
        options: [
          '안전모만 착용',
          '안전화만 착용',
          '안전모, 안전화, 보호안경',
          '장갑만 착용'
        ],
        correctAnswer: 2,
        explanation: '컨베이어 점검 시에는 낙하물, 미끄럼, 비산물 등의 위험에 대비하여 안전모, 안전화, 보호안경을 모두 착용해야 합니다.',
        category: '보호구'
      },
      {
        id: 'quiz-004',
        question: '용접작업 시 주변에 배치해야 할 필수 안전장비는?',
        options: [
          '선풍기',
          '소화기',
          '의자',
          '음료수'
        ],
        correctAnswer: 1,
        explanation: '용접작업 시에는 스패터나 화재 위험에 대비하여 소화기를 작업장 주변에 비치해야 합니다.',
        category: '화재예방'
      },
      {
        id: 'quiz-005',
        question: '작업 중 설비에서 이상음이 발생했을 때 올바른 대응은?',
        options: [
          '소음이므로 무시하고 계속 작업',
          '즉시 작업 중단 후 안전한 곳으로 대피',
          '소음의 원인만 확인',
          '다른 작업자에게만 알림'
        ],
        correctAnswer: 1,
        explanation: '설비의 이상음은 고장이나 사고의 전조증상일 수 있으므로 즉시 작업을 중단하고 안전한 곳으로 대피한 후 전문가의 점검을 받아야 합니다.',
        category: '비상대응'
      }
    ];
  }

  async findRelevantRegulations(equipmentType: string, workType: string): Promise<RegulationDocument[]> {
    return this.regulations.filter(reg => 
      reg.applicableEquipment.some(eq => 
        eq.toLowerCase().includes(equipmentType.toLowerCase()) || 
        equipmentType.toLowerCase().includes(eq.toLowerCase())
      )
    ).slice(0, 3);
  }

  async findSimilarIncidents(equipmentType: string, workType: string): Promise<IncidentRecord[]> {
    const similar = this.incidents.filter(inc => 
      inc.equipmentType.toLowerCase().includes(equipmentType.toLowerCase()) ||
      inc.workType.toLowerCase().includes(workType.toLowerCase()) ||
      equipmentType.toLowerCase().includes(inc.equipmentType.toLowerCase()) ||
      workType.toLowerCase().includes(inc.workType.toLowerCase())
    );
    
    // Sort by relevance and return top 3
    return similar.slice(0, 3);
  }

  async findEducationMaterials(equipmentType: string, workType: string): Promise<EducationMaterial[]> {
    const relevant = this.educationMaterials.filter(material => 
      material.equipmentTypes.some(eq => 
        eq.toLowerCase().includes(equipmentType.toLowerCase()) || 
        equipmentType.toLowerCase().includes(eq.toLowerCase())
      ) ||
      material.workTypes.some(wt => 
        wt.toLowerCase().includes(workType.toLowerCase()) || 
        workType.toLowerCase().includes(wt.toLowerCase())
      )
    );
    
    return relevant.slice(0, 3);
  }

  async generateQuizQuestions(equipmentType: string, workType: string): Promise<QuizQuestion[]> {
    // Filter questions relevant to the equipment and work type
    const relevant = this.quizQuestions.filter(quiz => 
      quiz.question.toLowerCase().includes(equipmentType.toLowerCase()) ||
      quiz.question.toLowerCase().includes(workType.toLowerCase()) ||
      quiz.category === '안전절차' || 
      quiz.category === '비상대응'
    );
    
    // If we don't have enough relevant questions, include general safety questions
    if (relevant.length < 5) {
      const general = this.quizQuestions.filter(quiz => 
        !relevant.some(r => r.id === quiz.id)
      );
      relevant.push(...general);
    }
    
    // Shuffle and return 5 questions
    const shuffled = relevant.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }

  async getSafetySlogan(equipmentType: string, workType: string): Promise<string> {
    const slogans = [
      "안전은 선택이 아닌 필수입니다!",
      "오늘의 안전점검이 내일의 무사고를 만듭니다.",
      "서두르지 말고 안전하게, 정확한 절차를 따르세요.",
      "나의 안전은 나와 가족의 행복입니다.",
      "안전수칙 준수가 최고의 기술입니다.",
      `${equipmentType} 작업, 안전이 최우선!`,
      `${workType} 시작 전 안전점검은 필수!`,
      "LOTO 절차로 안전한 작업환경을 만들어요.",
      "보호구 착용은 생명을 지키는 첫걸음입니다.",
      "작은 부주의가 큰 사고로, 항상 경각심을 가지세요."
    ];
    
    return slogans[Math.floor(Math.random() * slogans.length)];
  }
}

export const ragService = new RAGService();