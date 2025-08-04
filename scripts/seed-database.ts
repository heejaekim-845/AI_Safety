import { db } from "../server/db";
import { equipment, workTypes, workProcedures, incidents, workSchedules } from "../shared/schema";

async function seedDatabase() {
  try {
    console.log("Seeding database with initial data...");

    // Sample equipment data
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
        highVoltageRisk: true,
        highPressureRisk: true,
        highTemperatureRisk: false,
        heightRisk: false,
        heavyWeightRisk: true,
        requiredSafetyEquipment: ["안전모", "안전화", "보호안경", "귀마개"],
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
        name: "컨베이어 벨트",
        code: "CONV-B-201", 
        location: "대전",
        riskLevel: "RED",
        manufacturer: "삼성벨트시스템",
        installYear: 2019,
        modelName: "SBC-2000",
        specification: "길이: 50m, 폭: 1.2m, 속도: 2m/s",
        highVoltageRisk: true,
        highPressureRisk: false,
        highTemperatureRisk: false,
        heightRisk: false,
        heavyWeightRisk: true,
        requiredSafetyEquipment: ["안전모", "안전화", "보호안경"],
        lotoPoints: [
          {
            id: "모터 전원 차단기",
            type: "전기",
            location: "제어박스"
          }
        ],
        emergencyContacts: [
          {
            name: "컨베이어 기술자",
            phone: "010-1111-2222",
            role: "정비"
          }
        ]
      }
    ];

    // Insert equipment
    console.log("Inserting equipment...");
    for (const equip of sampleEquipment) {
      await db.insert(equipment).values(equip);
    }

    // Sample work types
    const sampleWorkTypes = [
      {
        equipmentId: 1,
        name: "일반 점검",
        description: "압축기 일반 점검 작업",
        requiresPermit: false,
        estimatedDuration: 30,
        requiredQualifications: ["기계정비기능사"],
      },
      {
        equipmentId: 1,
        name: "오일 교환",
        description: "압축기 오일 교환 작업",
        requiresPermit: true,
        estimatedDuration: 60,
        requiredQualifications: ["기계정비기능사", "환경안전교육"],
      },
      {
        equipmentId: 2,
        name: "벨트 교체",
        description: "컨베이어 벨트 교체 작업",
        requiresPermit: true,
        estimatedDuration: 120,
        requiredQualifications: ["기계정비기능사", "안전교육"],
      }
    ];

    console.log("Inserting work types...");
    for (const workType of sampleWorkTypes) {
      await db.insert(workTypes).values(workType);
    }

    // Sample work procedures
    const sampleProcedures = [
      {
        workTypeId: 1,
        stepNumber: 1,
        category: "안전조치",
        title: "전원 차단 및 LOTO 적용",
        description: "주 전원을 차단하고 잠금 장치를 설치합니다.",
        checklistItems: ["주 전원 차단 확인", "LOTO 태그 부착", "에너지 격리 확인"],
        safetyNotes: "전원 차단 후 반드시 전압 측정기로 무전압 상태를 확인하세요.",
      },
      {
        workTypeId: 1,
        stepNumber: 2,
        category: "기기조작",
        title: "압력 게이지 확인",
        description: "압축기의 압력 게이지를 확인합니다.",
        checklistItems: ["압력 게이지 수치 기록", "이상 유무 확인"],
        safetyNotes: "압력이 완전히 해제된 후 작업을 진행하세요.",
      }
    ];

    console.log("Inserting procedures...");
    for (const proc of sampleProcedures) {
      await db.insert(workProcedures).values(proc);
    }

    // Sample work schedule
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const sampleSchedule = {
      equipmentId: 2,
      workTypeId: 3,
      scheduledDate: tomorrow,
      briefingTime: "09:00",
      workerName: "김작업자",
      workLocation: "대전",
      specialNotes: "날씨 확인 필요",
      status: "scheduled"
    };

    console.log("Inserting work schedule...");
    await db.insert(workSchedules).values(sampleSchedule);

    console.log("Database seeded successfully!");
    
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seedDatabase();