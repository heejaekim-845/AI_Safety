import {
  equipment,
  workTypes,
  workProcedures,
  incidents,
  workSessions,
  riskReports,
  type Equipment,
  type InsertEquipment,
  type WorkType,
  type InsertWorkType,
  type WorkProcedure,
  type InsertWorkProcedure,
  type Incident,
  type InsertIncident,
  type WorkSession,
  type InsertWorkSession,
  type RiskReport,
  type InsertRiskReport,
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // Equipment operations
  getAllEquipment(): Promise<Equipment[]>;
  getEquipmentById(id: number): Promise<Equipment | undefined>;
  getEquipmentByCode(code: string): Promise<Equipment | undefined>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, equipment: Partial<InsertEquipment>): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;

  // Work types operations
  getWorkTypesByEquipmentId(equipmentId: number): Promise<WorkType[]>;
  getWorkTypeById(id: number): Promise<WorkType | undefined>;
  createWorkType(workType: InsertWorkType): Promise<WorkType>;
  updateWorkType(id: number, workType: Partial<InsertWorkType>): Promise<WorkType>;
  deleteWorkType(id: number): Promise<void>;

  // Work procedures operations
  getProceduresByWorkTypeId(workTypeId: number): Promise<WorkProcedure[]>;
  createWorkProcedure(procedure: InsertWorkProcedure): Promise<WorkProcedure>;
  updateWorkProcedure(id: number, procedure: Partial<InsertWorkProcedure>): Promise<WorkProcedure>;
  deleteWorkProcedure(id: number): Promise<void>;

  // Incidents operations
  getIncidentsByEquipmentId(equipmentId: number): Promise<Incident[]>;
  getIncidentsByWorkTypeId(workTypeId: number): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: number, incident: Partial<InsertIncident>): Promise<Incident>;
  deleteIncident(id: number): Promise<void>;

  // Work sessions operations
  createWorkSession(session: InsertWorkSession): Promise<WorkSession>;
  getWorkSessionById(id: number): Promise<WorkSession | undefined>;
  updateWorkSession(id: number, session: Partial<WorkSession>): Promise<WorkSession>;
  getActiveWorkSessions(): Promise<WorkSession[]>;

  // Risk reports operations
  createRiskReport(report: InsertRiskReport): Promise<RiskReport>;
  getRiskReportsByEquipmentId(equipmentId: number): Promise<RiskReport[]>;
}

export class MemStorage implements IStorage {
  private equipment: Map<number, Equipment> = new Map();
  private workTypes: Map<number, WorkType> = new Map();
  private workProcedures: Map<number, WorkProcedure> = new Map();
  private incidents: Map<number, Incident> = new Map();
  private workSessions: Map<number, WorkSession> = new Map();
  private riskReports: Map<number, RiskReport> = new Map();
  private currentId = 3;

  constructor() {
    this.initializeTestData();
  }

  private initializeTestData() {
    // Sample equipment data
    const sampleEquipment: Equipment = {
      id: 1,
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
      ],
      safetyDeviceImages: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const sampleEquipment2: Equipment = {
      id: 2,
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
          id: "가스 공급 밸브",
          type: "가스",
          location: "보일러실 입구"
        },
        {
          id: "주 전원 스위치",
          type: "전기",
          location: "제어판넬"
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
      ],
      safetyDeviceImages: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.equipment.set(1, sampleEquipment);
    this.equipment.set(2, sampleEquipment2);

    // Sample work types
    const workType1: WorkType = {
      id: 1,
      name: "일반 점검",
      equipmentId: 1,
      description: "압축기 일반 점검 작업",
      requiresPermit: false,
      estimatedDuration: 30,
      requiredQualifications: ["기계정비기능사"],
      requiredEquipment: null,
      environmentalRequirements: null,
      safetyPrecautions: null,
      legalRequirements: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const workType2: WorkType = {
      id: 2,
      name: "오일 교환",
      equipmentId: 1,
      description: "압축기 오일 교환 작업",
      requiresPermit: true,
      estimatedDuration: 60,
      requiredQualifications: ["기계정비기능사", "환경안전교육"],
      requiredEquipment: null,
      environmentalRequirements: null,
      safetyPrecautions: null,
      legalRequirements: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const workType3: WorkType = {
      id: 3,
      name: "연료 공급 차단",
      equipmentId: 2,
      description: "보일러 연료 공급 차단 작업",
      requiresPermit: true,
      estimatedDuration: 45,
      requiredQualifications: ["보일러기능사", "가스안전교육"],
      requiredEquipment: null,
      environmentalRequirements: null,
      safetyPrecautions: null,
      legalRequirements: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const workType4: WorkType = {
      id: 4,
      name: "압력 및 온도 확인",
      equipmentId: 2,
      description: "보일러 압력 및 온도 확인 작업",
      requiresPermit: false,
      estimatedDuration: 20,
      requiredQualifications: ["보일러기능사"],
      requiredEquipment: null,
      environmentalRequirements: null,
      safetyPrecautions: null,
      legalRequirements: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workTypes.set(1, workType1);
    this.workTypes.set(2, workType2);
    this.workTypes.set(3, workType3);
    this.workTypes.set(4, workType4);

    // Sample work procedures
    const procedures = [
      {
        id: 1,
        workTypeId: 1,
        stepNumber: 1,
        category: "안전조치",
        title: "전원 차단 및 LOTO 적용",
        description: "주 전원을 차단하고 잠금 장치를 설치합니다.",
        checklistItems: ["주 전원 차단 확인", "LOTO 태그 부착", "에너지 격리 확인"],
        safetyNotes: "전원 차단 후 반드시 전압 측정기로 무전압 상태를 확인하세요.",
        createdAt: new Date()
      },
      {
        id: 2,
        workTypeId: 1,
        stepNumber: 2,
        category: "기기조작",
        title: "압력 게이지 확인",
        description: "압축기의 압력 게이지를 확인합니다.",
        checklistItems: ["압력 게이지 수치 기록", "이상 유무 확인"],
        safetyNotes: "압력이 완전히 해제된 후 작업을 진행하세요.",
        createdAt: new Date()
      }
    ];

    procedures.forEach(proc => {
      this.workProcedures.set(proc.id, proc as WorkProcedure);
    });

    // Sample incident
    const incident1: Incident = {
      id: 1,
      equipmentId: 1,
      workTypeId: null,
      title: "압력 게이지 이상",
      description: "압력 게이지가 정상 범위를 벗어남",
      severity: "MEDIUM",
      incidentDate: new Date(),
      createdAt: new Date()
    };

    this.incidents.set(1, incident1);
  }

  // Equipment operations
  async getAllEquipment(): Promise<Equipment[]> {
    return Array.from(this.equipment.values());
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    return this.equipment.get(id);
  }

  async getEquipmentByCode(code: string): Promise<Equipment | undefined> {
    return Array.from(this.equipment.values()).find(e => e.code === code);
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const id = this.currentId++;
    const newEquipment: Equipment = {
      id,
      ...equipmentData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.equipment.set(id, newEquipment);
    return newEquipment;
  }

  async updateEquipment(id: number, equipmentData: Partial<InsertEquipment>): Promise<Equipment> {
    const existing = this.equipment.get(id);
    if (!existing) throw new Error(`Equipment with id ${id} not found`);
    
    const updated = { ...existing, ...equipmentData, updatedAt: new Date() };
    this.equipment.set(id, updated);
    return updated;
  }

  async deleteEquipment(id: number): Promise<void> {
    this.equipment.delete(id);
  }

  // Work types operations
  async getWorkTypesByEquipmentId(equipmentId: number): Promise<WorkType[]> {
    return Array.from(this.workTypes.values()).filter(wt => wt.equipmentId === equipmentId);
  }

  async getWorkTypeById(id: number): Promise<WorkType | undefined> {
    return this.workTypes.get(id);
  }

  async createWorkType(workTypeData: InsertWorkType): Promise<WorkType> {
    const id = this.currentId++;
    const newWorkType: WorkType = {
      id,
      ...workTypeData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.workTypes.set(id, newWorkType);
    return newWorkType;
  }

  async updateWorkType(id: number, workTypeData: Partial<InsertWorkType>): Promise<WorkType> {
    const existing = this.workTypes.get(id);
    if (!existing) throw new Error(`WorkType with id ${id} not found`);
    
    const updated = { ...existing, ...workTypeData, updatedAt: new Date() };
    this.workTypes.set(id, updated);
    return updated;
  }

  async deleteWorkType(id: number): Promise<void> {
    this.workTypes.delete(id);
  }

  // Work procedures operations
  async getProceduresByWorkTypeId(workTypeId: number): Promise<WorkProcedure[]> {
    return Array.from(this.workProcedures.values())
      .filter(wp => wp.workTypeId === workTypeId)
      .sort((a, b) => a.stepNumber - b.stepNumber);
  }

  async createWorkProcedure(procedureData: InsertWorkProcedure): Promise<WorkProcedure> {
    const id = this.currentId++;
    const newProcedure: WorkProcedure = {
      id,
      ...procedureData,
      createdAt: new Date()
    };
    this.workProcedures.set(id, newProcedure);
    return newProcedure;
  }

  async updateWorkProcedure(id: number, procedureData: Partial<InsertWorkProcedure>): Promise<WorkProcedure> {
    const existing = this.workProcedures.get(id);
    if (!existing) throw new Error(`WorkProcedure with id ${id} not found`);
    
    const updated = { ...existing, ...procedureData };
    this.workProcedures.set(id, updated);
    return updated;
  }

  async deleteWorkProcedure(id: number): Promise<void> {
    this.workProcedures.delete(id);
  }

  // Incidents operations
  async getIncidentsByEquipmentId(equipmentId: number): Promise<Incident[]> {
    return Array.from(this.incidents.values()).filter(i => i.equipmentId === equipmentId);
  }

  async getIncidentsByWorkTypeId(workTypeId: number): Promise<Incident[]> {
    return Array.from(this.incidents.values()).filter(i => i.workTypeId === workTypeId);
  }

  async createIncident(incidentData: InsertIncident): Promise<Incident> {
    const id = this.currentId++;
    const newIncident: Incident = {
      id,
      ...incidentData,
      createdAt: new Date()
    };
    this.incidents.set(id, newIncident);
    return newIncident;
  }

  // Work sessions operations
  async createWorkSession(sessionData: InsertWorkSession): Promise<WorkSession> {
    const id = this.currentId++;
    const newSession: WorkSession = {
      id,
      ...sessionData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.workSessions.set(id, newSession);
    return newSession;
  }

  async getWorkSessionById(id: number): Promise<WorkSession | undefined> {
    return this.workSessions.get(id);
  }

  async updateWorkSession(id: number, sessionData: Partial<WorkSession>): Promise<WorkSession> {
    const existing = this.workSessions.get(id);
    if (!existing) throw new Error(`WorkSession with id ${id} not found`);
    
    const updated = { ...existing, ...sessionData, updatedAt: new Date() };
    this.workSessions.set(id, updated);
    return updated;
  }

  async getActiveWorkSessions(): Promise<WorkSession[]> {
    return Array.from(this.workSessions.values())
      .filter(ws => !ws.completedAt)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  // Risk reports operations
  async createRiskReport(reportData: InsertRiskReport): Promise<RiskReport> {
    const id = this.currentId++;
    const newReport: RiskReport = {
      id,
      ...reportData,
      createdAt: new Date()
    };
    this.riskReports.set(id, newReport);
    return newReport;
  }

  async getRiskReportsByEquipmentId(equipmentId: number): Promise<RiskReport[]> {
    return Array.from(this.riskReports.values())
      .filter(rr => rr.equipmentId === equipmentId)
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() ?? 0;
        const bTime = b.createdAt?.getTime() ?? 0;
        return bTime - aTime;
      });
  }
}

// Create storage instance
// Use database storage for persistent data
import { DatabaseStorage } from "./database-storage";
export const storage = new DatabaseStorage();