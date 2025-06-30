import { db } from "./db";
import { 
  equipment, 
  workTypes, 
  workProcedures, 
  incidents, 
  workSessions, 
  riskReports 
} from "@shared/schema";

export async function initializeDatabase() {
  try {
    console.log("Testing database connection...");
    
    // Test basic connection
    const result = await db.execute(`SELECT 1 as test`);
    console.log("Database connection successful:", result);

    // Create sample equipment data
    console.log("Creating sample equipment...");
    const sampleEquipment = await db.insert(equipment).values([
      {
        name: "압축기 A-101",
        code: "COMP-A-101", 
        location: "1공장 A동",
        riskLevel: "MEDIUM",
        manufacturer: "현대중공업",
        installYear: 2019,
        modelName: "HC-500A",
        imageUrl: "/attached_assets/air-compressor-solution_1750831656695.jpg",
        specification: "용량: 500L/min\n압력: 8bar\n전력: 15kW",
        highVoltage: true,
        highVoltageDetails: "AC 380V 3상 15kW 모터 사용",
        highPressure: true, 
        highPressureDetails: "최대 8bar 압축공기 생성",
        highTemperature: false,
        heightWork: false,
        heavyWeight: false,
        lotopRequired: true,
        lotopPoints: ["전력 차단", "압축공기 배출"],
        requiredSafetyEquipment: ["안전모", "안전화", "절연장갑", "압력계"],
        emergencyContacts: [
          { name: "설비담당자 김철수", phone: "010-1234-5678", role: "설비관리" },
          { name: "안전관리자 박영희", phone: "010-9876-5432", role: "안전총괄" }
        ]
      },
      {
        name: "보일러 B-102",
        code: "BOILER-B-102",
        location: "2공장 B동", 
        riskLevel: "HIGH",
        manufacturer: "삼성보일러",
        installYear: 2020,
        modelName: "SB-1000",
        specification: "용량: 1000kg/h\n압력: 10bar\n연료: LNG",
        highVoltage: true,
        highVoltageDetails: "AC 380V 제어시스템",
        highPressure: true,
        highPressureDetails: "최대 10bar 증기압력",
        highTemperature: true,
        highTemperatureDetails: "증기온도 180°C, 연소온도 1200°C",
        heightWork: false,
        heavyWeight: false,
        lotopRequired: true,
        lotopPoints: ["전력 차단", "연료 차단", "증기 배출"],
        requiredSafetyEquipment: ["안전모", "안전화", "내열장갑", "가스감지기"],
        emergencyContacts: [
          { name: "보일러기사 이동훈", phone: "010-5555-1111", role: "보일러운전" },
          { name: "안전관리자 박영희", phone: "010-9876-5432", role: "안전총괄" }
        ]
      }
    ]).returning();

    console.log("Sample equipment created:", sampleEquipment);

    // Create work types
    console.log("Creating work types...");
    const sampleWorkTypes = await db.insert(workTypes).values([
      {
        equipmentId: sampleEquipment[0].id,
        name: "일상 점검",
        description: "압축기 일상 점검 및 운전 상태 확인",
        requiredQualifications: ["기계정비기능사"],
        estimatedDuration: 60
      },
      {
        equipmentId: sampleEquipment[0].id,
        name: "정기 정비",
        description: "압축기 정기 정비 및 부품 교체",
        requiredQualifications: ["기계정비기능사", "압축기 교육이수"],
        estimatedDuration: 240,
        requiresPermit: true
      },
      {
        equipmentId: sampleEquipment[1].id,
        name: "보일러 점검",
        description: "보일러 안전 점검 및 운전 준비",
        requiredQualifications: ["보일러기사"],
        estimatedDuration: 45
      },
      {
        equipmentId: sampleEquipment[1].id,
        name: "보일러 정지",
        description: "보일러 안전 정지 절차",
        requiredQualifications: ["보일러기사"],
        estimatedDuration: 30
      }
    ]).returning();

    console.log("Work types created:", sampleWorkTypes);

    // Create work procedures
    console.log("Creating work procedures...");
    await db.insert(workProcedures).values([
      // Compressor procedures
      {
        workTypeId: sampleWorkTypes[0].id,
        stepNumber: 1,
        category: "안전조치",
        title: "안전 준비",
        description: "작업 전 안전장비 착용 및 전력 차단",
        checklistItems: ["안전모 착용", "안전화 착용", "절연장갑 착용", "전력 차단 확인"],
        safetyNotes: "반드시 전력을 차단한 후 작업을 시작하세요."
      },
      {
        workTypeId: sampleWorkTypes[0].id,
        stepNumber: 2,
        category: "상태인지", 
        title: "외관 점검",
        description: "압축기 외관 및 배관 상태 점검",
        checklistItems: ["누유 확인", "진동 확인", "이상음 확인", "배관 연결상태 확인"],
        safetyNotes: "이상 발견 시 즉시 작업을 중단하고 보고하세요."
      },
      {
        workTypeId: sampleWorkTypes[0].id,
        stepNumber: 3,
        category: "기기조작",
        title: "압력 확인",
        description: "압축기 압력계 지시값 확인 및 기록",
        checklistItems: ["압력계 지시값 확인", "안전밸브 작동 확인", "압력 기록"],
        safetyNotes: "정상 범위를 벗어나면 운전을 중단하세요."
      },
      // Boiler procedures  
      {
        workTypeId: sampleWorkTypes[2].id,
        stepNumber: 1,
        category: "안전조치",
        title: "연료 공급 차단",
        description: "보일러 작업 전 연료 밸브 완전 차단 및 확인",
        checklistItems: ["주 연료 밸브 차단", "보조 연료 밸브 차단", "차단 확인"],
        safetyNotes: "연료 차단 후 반드시 압력계로 확인하세요."
      },
      {
        workTypeId: sampleWorkTypes[2].id,
        stepNumber: 2,
        category: "상태인지",
        title: "압력 및 온도 확인", 
        description: "보일러 시스템의 압력과 온도 상태 점검",
        checklistItems: ["압력계 확인", "온도계 확인", "안전밸브 상태 점검"],
        safetyNotes: "정상 범위를 벗어나면 즉시 작업을 중단하세요."
      },
      {
        workTypeId: sampleWorkTypes[2].id,
        stepNumber: 3,
        category: "기기조작",
        title: "연소실 점검",
        description: "연소실 내부 상태 및 버너 점검",
        checklistItems: ["연소실 내부 확인", "버너 상태 점검", "배기 덕트 확인"],
        safetyNotes: "연소실 점검 시 충분한 환기를 확보하세요."
      },
      {
        workTypeId: sampleWorkTypes[3].id,
        stepNumber: 1,
        category: "기기조작",
        title: "연소 정지",
        description: "버너 운전 정지 및 연료 공급 차단",
        checklistItems: ["버너 정지", "연료 밸브 차단", "정지 확인"],
        safetyNotes: "정지 절차를 순서대로 진행하세요."
      },
      {
        workTypeId: sampleWorkTypes[3].id,
        stepNumber: 2,
        category: "안전조치",
        title: "냉각 대기",
        description: "보일러 온도 하강 대기 및 모니터링",
        checklistItems: ["온도 모니터링", "압력 감소 확인", "냉각수 순환 확인"],
        safetyNotes: "충분한 냉각 시간을 확보하세요."
      }
    ]);

    // Create sample incident
    await db.insert(incidents).values({
      equipmentId: sampleEquipment[0].id,
      workTypeId: sampleWorkTypes[0].id,
      title: "압력 센서 이상",
      description: "일상 점검 중 압력 센서의 지시값 이상으로 경미한 누출 발생",
      severity: "MEDIUM",
      incidentDate: new Date("2024-01-15")
    });

    console.log("Database initialization completed successfully!");
    
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}