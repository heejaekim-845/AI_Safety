import { db } from "./db";
import { 
  equipment, 
  workTypes, 
  workProcedures, 
  incidents, 
  workSessions,
  riskReports
} from "@shared/schema";

// Sample data from current memory storage
const sampleEquipment = [
  {
    name: "압축기 A-101",
    code: "COMP-A-101",
    location: "공장 A동 1층",
    riskLevel: "YELLOW",
    manufacturer: "현대중공업",
    installYear: 2020,
    modelName: "HHI-AC-500",
    imageUrl: "/attached_assets/air-compressor-solution_1750831656695.jpg",
    specification: "압력: 8bar, 용량: 500L, 전력: 37kW",
    highVoltage: true,
    highPressure: true,
    highTemperature: false,
    chemical: false,
    moving: true,
    lifting: false,
    confined: false,
    height: false,
    noise: true,
    requiredSafetyItems: ["안전모", "안전화", "보호안경", "귀마개"],
    hazardousChemicals: [],
    lotoPoints: [
      {
        id: "주 전원 차단기",
        type: "전기",
        location: "제어반 상단"
      },
      {
        id: "에어 공급 밸브",
        type: "에너지원",
        location: "압축기 입구"
      }
    ],
    emergencyContacts: [
      {
        name: "설비 담당자",
        phone: "010-1234-5678",
        role: "정비"
      },
      {
        name: "안전 관리자",
        phone: "010-9876-5432",
        role: "안전"
      }
    ]
  },
  {
    name: "보일러 B-201",
    code: "BOILER-B-201",
    location: "공장 B동 지하 1층",
    riskLevel: "RED",
    manufacturer: "삼성보일러",
    installYear: 2018,
    modelName: "SB-HT-1000",
    imageUrl: null,
    specification: "압력: 16bar, 온도: 180°C, 연료: 천연가스",
    highVoltage: true,
    highPressure: true,
    highTemperature: true,
    chemical: true,
    moving: false,
    lifting: false,
    confined: true,
    height: false,
    noise: true,
    requiredSafetyItems: ["안전모", "안전화", "보호안경", "내열장갑", "가스검지기"],
    hazardousChemicals: [
      {
        name: "천연가스",
        cas: "74-82-8",
        msdsUrl: "/msds/natural-gas.pdf"
      }
    ],
    lotoPoints: [
      {
        name: "가스 공급 밸브",
        type: "가스",
        location: "보일러실 입구",
        lockType: "밸브 잠금"
      },
      {
        name: "주 전원 스위치",
        type: "전기",
        location: "제어판넬",
        lockType: "자물쇠"
      }
    ],
    emergencyContacts: [
      {
        name: "보일러 기술자",
        phone: "010-2468-1357",
        role: "정비"
      },
      {
        name: "가스안전공사",
        phone: "1544-4500",
        role: "응급"
      }
    ]
  }
];

const sampleWorkTypes = [
  // Compressor work types
  {
    name: "일반 점검",
    equipmentId: 1,
    description: "압축기 일반 점검 작업",
    requiresPermit: false,
    estimatedDuration: 30,
    requiredQualifications: ["기계정비기능사"]
  },
  {
    name: "오일 교환",
    equipmentId: 1,
    description: "압축기 오일 교환 작업",
    requiresPermit: true,
    estimatedDuration: 60,
    requiredQualifications: ["기계정비기능사", "환경안전교육"]
  },
  // Boiler work types
  {
    name: "연료 공급 차단",
    equipmentId: 2,
    description: "보일러 연료 공급 차단 작업",
    requiresPermit: true,
    estimatedDuration: 45,
    requiredQualifications: ["보일러기능사", "가스안전교육"]
  },
  {
    name: "압력 및 온도 확인",
    equipmentId: 2,
    description: "보일러 압력 및 온도 확인 작업",
    requiresPermit: false,
    estimatedDuration: 20,
    requiredQualifications: ["보일러기능사"]
  }
];

const sampleWorkProcedures = [
  // Compressor procedures
  {
    workTypeId: 1,
    stepNumber: 1,
    category: "안전조치",
    title: "전원 차단 및 LOTO 적용",
    description: "주 전원을 차단하고 잠금 장치를 설치합니다.",
    checklistItems: ["주 전원 차단 확인", "LOTO 태그 부착", "에너지 격리 확인"],
    safetyNotes: "전원 차단 후 반드시 전압 측정기로 무전압 상태를 확인하세요."
  },
  {
    workTypeId: 1,
    stepNumber: 2,
    category: "기기조작",
    title: "압력 게이지 확인",
    description: "압축기의 압력 게이지를 확인합니다.",
    checklistItems: ["압력 게이지 수치 기록", "이상 유무 확인"],
    safetyNotes: "압력이 완전히 해제된 후 작업을 진행하세요."
  },
  // Boiler procedures
  {
    workTypeId: 3,
    stepNumber: 1,
    category: "안전조치",
    title: "가스 공급 차단",
    description: "보일러 가스 공급 밸브를 차단합니다.",
    checklistItems: ["메인 가스 밸브 차단", "가스 누출 점검", "환기 확인"],
    safetyNotes: "가스 검지기로 누출 여부를 반드시 확인하세요."
  },
  {
    workTypeId: 4,
    stepNumber: 1,
    category: "상태인지",
    title: "압력계 점검",
    description: "보일러 압력계 수치를 확인합니다.",
    checklistItems: ["압력계 수치 기록", "정상 범위 확인"],
    safetyNotes: "정상 운전 압력 범위를 벗어날 경우 즉시 작업을 중단하세요."
  }
];

export async function migrateData() {
  console.log("Starting database migration...");
  
  try {
    // Insert equipment
    console.log("Inserting equipment data...");
    const insertedEquipment = await db.insert(equipment).values(sampleEquipment).returning();
    console.log(`Inserted ${insertedEquipment.length} equipment records`);
    
    // Insert work types
    console.log("Inserting work types...");
    const insertedWorkTypes = await db.insert(workTypes).values(sampleWorkTypes).returning();
    console.log(`Inserted ${insertedWorkTypes.length} work type records`);
    
    // Insert work procedures
    console.log("Inserting work procedures...");
    const insertedProcedures = await db.insert(workProcedures).values(sampleWorkProcedures).returning();
    console.log(`Inserted ${insertedProcedures.length} work procedure records`);
    
    console.log("Database migration completed successfully!");
    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    return false;
  }
}

export async function testConnection() {
  try {
    console.log("Testing database connection...");
    const result = await db.select().from(equipment).limit(1);
    console.log("Database connection successful!");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}