import {
  equipment,
  workTypes,
  workProcedures,
  incidents,
  workSessions,
  riskReports,
  workSchedules,
  safetyBriefings,
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
  type WorkSchedule,
  type InsertWorkSchedule,
  type SafetyBriefing,
  type InsertSafetyBriefing,
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

  // Work schedules operations
  createWorkSchedule(schedule: InsertWorkSchedule): Promise<WorkSchedule>;
  getWorkSchedulesByDate(date: string): Promise<WorkSchedule[]>;
  getWorkScheduleById(id: number): Promise<WorkSchedule | undefined>;
  updateWorkSchedule(id: number, schedule: Partial<WorkSchedule>): Promise<WorkSchedule>;
  deleteWorkSchedule(id: number): Promise<void>;

  // Safety briefings operations
  createSafetyBriefing(briefing: InsertSafetyBriefing): Promise<SafetyBriefing>;
  getSafetyBriefingByWorkScheduleId(workScheduleId: number): Promise<SafetyBriefing | undefined>;
  updateSafetyBriefing(id: number, briefing: Partial<SafetyBriefing>): Promise<SafetyBriefing>;
}

export class MemStorage implements IStorage {
  private equipment: Map<number, Equipment> = new Map();
  private workTypes: Map<number, WorkType> = new Map();
  private workProcedures: Map<number, WorkProcedure> = new Map();
  private incidents: Map<number, Incident> = new Map();
  private workSessions: Map<number, WorkSession> = new Map();
  private riskReports: Map<number, RiskReport> = new Map();
  private workSchedules: Map<number, WorkSchedule> = new Map();
  private safetyBriefings: Map<number, SafetyBriefing> = new Map();
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
      manufacturer: "현대중공업",
      installYear: 2020,
      specification: "압력: 8bar, 용량: 500L, 전력: 37kW",
      imageUrl: "/attached_assets/air-compressor-solution_1750831656695.jpg",
      modelName: "HHI-AC-500",
      riskLevel: "YELLOW",
      highTemperatureRisk: false,
      highTemperatureDetails: null,
      highPressureRisk: true,
      highPressureDetails: "작동 압력: 8bar",
      highVoltageRisk: true,
      highVoltageDetails: "37kW 전력 사용",
      heightRisk: false,
      heightDetails: null,
      heavyWeightRisk: true,
      heavyWeightDetails: "압축기 무게: 500kg",
      riskFactors: null,
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
      safetyFacilityLocations: null,
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
      requiredSafetyEquipment: ["안전모", "안전화", "보호안경", "귀마개"],
      safetyDeviceImages: null,
      hazardousChemicalType: null,
      hazardousChemicalName: null,
      msdsImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const sampleEquipment2: Equipment = {
      id: 2,
      name: "보일러 B-201",
      code: "BOILER-B-201",
      location: "공장 B동 지하 1층",
      manufacturer: "삼성보일러",
      installYear: 2018,
      specification: "압력: 16bar, 온도: 180°C, 연료: 천연가스",
      imageUrl: null,
      modelName: "SB-HT-1000",
      riskLevel: "RED",
      highTemperatureRisk: true,
      highTemperatureDetails: "작동 온도: 180°C",
      highPressureRisk: true,
      highPressureDetails: "작동 압력: 16bar",
      highVoltageRisk: true,
      highVoltageDetails: "전기 제어 시스템",
      heightRisk: false,
      heightDetails: null,
      heavyWeightRisk: false,
      heavyWeightDetails: null,
      riskFactors: null,
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
      safetyFacilityLocations: null,
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
      requiredSafetyEquipment: ["안전모", "안전화", "보호안경", "내열장갑", "가스검지기"],
      safetyDeviceImages: null,
      hazardousChemicalType: "가스",
      hazardousChemicalName: "천연가스",
      msdsImageUrl: null,
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
      requiredTools: null,
      environmentalRequirements: null,
      legalRequirements: null,
      createdAt: new Date()
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
      requiredTools: null,
      environmentalRequirements: null,
      legalRequirements: null,
      createdAt: new Date()
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
      requiredTools: null,
      environmentalRequirements: null,
      legalRequirements: null,
      createdAt: new Date()
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
      requiredTools: null,
      environmentalRequirements: null,
      legalRequirements: null,
      createdAt: new Date()
    };

    this.workTypes.set(1, workType1);
    this.workTypes.set(2, workType2);
    this.workTypes.set(3, workType3);
    this.workTypes.set(4, workType4);

    // Sample work procedures
    const procedure1: WorkProcedure = {
      id: 1,
      workTypeId: 1,
      stepNumber: 1,
      category: "안전조치",
      title: "전원 차단 및 LOTO 적용",
      description: "주 전원을 차단하고 잠금 장치를 설치합니다.",
      checklistItems: ["주 전원 차단 확인", "LOTO 태그 부착", "에너지 격리 확인"],
      safetyNotes: "전원 차단 후 반드시 전압 측정기로 무전압 상태를 확인하세요.",
      createdAt: new Date()
    };

    const procedure2: WorkProcedure = {
      id: 2,
      workTypeId: 1,
      stepNumber: 2,
      category: "기기조작",
      title: "압력 게이지 확인",
      description: "압축기의 압력 게이지를 확인합니다.",
      checklistItems: ["압력 게이지 수치 기록", "이상 유무 확인"],
      safetyNotes: "압력이 완전히 해제된 후 작업을 진행하세요.",
      createdAt: new Date()
    };

    this.workProcedures.set(1, procedure1);
    this.workProcedures.set(2, procedure2);

    // Sample incident
    const incident1: Incident = {
      id: 1,
      equipmentId: 1,
      workTypeId: null,
      description: "압력 게이지가 정상 범위를 벗어남",
      severity: "MEDIUM",
      reporterName: "점검자",
      incidentDate: new Date(),
      actionsTaken: null,
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
      name: equipmentData.name,
      code: equipmentData.code,
      location: equipmentData.location,
      manufacturer: equipmentData.manufacturer ?? null,
      installYear: equipmentData.installYear ?? null,
      specification: equipmentData.specification ?? null,
      imageUrl: equipmentData.imageUrl ?? null,
      modelName: equipmentData.modelName ?? null,
      riskLevel: equipmentData.riskLevel ?? "MEDIUM",
      highTemperatureRisk: equipmentData.highTemperatureRisk ?? false,
      highTemperatureDetails: equipmentData.highTemperatureDetails ?? null,
      highPressureRisk: equipmentData.highPressureRisk ?? false,
      highPressureDetails: equipmentData.highPressureDetails ?? null,
      highVoltageRisk: equipmentData.highVoltageRisk ?? false,
      highVoltageDetails: equipmentData.highVoltageDetails ?? null,
      heightRisk: equipmentData.heightRisk ?? false,
      heightDetails: equipmentData.heightDetails ?? null,
      heavyWeightRisk: equipmentData.heavyWeightRisk ?? false,
      heavyWeightDetails: equipmentData.heavyWeightDetails ?? null,
      riskFactors: equipmentData.riskFactors ?? null,
      lotoPoints: equipmentData.lotoPoints ?? null,
      safetyFacilityLocations: equipmentData.safetyFacilityLocations ?? null,
      emergencyContacts: equipmentData.emergencyContacts ?? null,
      requiredSafetyEquipment: equipmentData.requiredSafetyEquipment ?? null,
      safetyDeviceImages: equipmentData.safetyDeviceImages ?? null,
      hazardousChemicalType: equipmentData.hazardousChemicalType ?? null,
      hazardousChemicalName: equipmentData.hazardousChemicalName ?? null,
      msdsImageUrl: equipmentData.msdsImageUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.equipment.set(id, newEquipment);
    return newEquipment;
  }

  async updateEquipment(id: number, equipmentData: Partial<InsertEquipment>): Promise<Equipment> {
    const existing = this.equipment.get(id);
    if (!existing) throw new Error(`Equipment with id ${id} not found`);
    
    const updated: Equipment = {
      ...existing,
      ...(equipmentData.name && { name: equipmentData.name }),
      ...(equipmentData.code && { code: equipmentData.code }),
      ...(equipmentData.location && { location: equipmentData.location }),
      ...(equipmentData.manufacturer !== undefined && { manufacturer: equipmentData.manufacturer }),
      ...(equipmentData.installYear !== undefined && { installYear: equipmentData.installYear }),
      ...(equipmentData.specification !== undefined && { specification: equipmentData.specification }),
      ...(equipmentData.imageUrl !== undefined && { imageUrl: equipmentData.imageUrl }),
      ...(equipmentData.modelName !== undefined && { modelName: equipmentData.modelName }),
      ...(equipmentData.riskLevel !== undefined && { riskLevel: equipmentData.riskLevel }),
      ...(equipmentData.highTemperatureRisk !== undefined && { highTemperatureRisk: equipmentData.highTemperatureRisk }),
      ...(equipmentData.highTemperatureDetails !== undefined && { highTemperatureDetails: equipmentData.highTemperatureDetails }),
      ...(equipmentData.highPressureRisk !== undefined && { highPressureRisk: equipmentData.highPressureRisk }),
      ...(equipmentData.highPressureDetails !== undefined && { highPressureDetails: equipmentData.highPressureDetails }),
      ...(equipmentData.highVoltageRisk !== undefined && { highVoltageRisk: equipmentData.highVoltageRisk }),
      ...(equipmentData.highVoltageDetails !== undefined && { highVoltageDetails: equipmentData.highVoltageDetails }),
      ...(equipmentData.heightRisk !== undefined && { heightRisk: equipmentData.heightRisk }),
      ...(equipmentData.heightDetails !== undefined && { heightDetails: equipmentData.heightDetails }),
      ...(equipmentData.heavyWeightRisk !== undefined && { heavyWeightRisk: equipmentData.heavyWeightRisk }),
      ...(equipmentData.heavyWeightDetails !== undefined && { heavyWeightDetails: equipmentData.heavyWeightDetails }),
      ...(equipmentData.riskFactors !== undefined && { riskFactors: equipmentData.riskFactors }),
      ...(equipmentData.lotoPoints !== undefined && { lotoPoints: equipmentData.lotoPoints }),
      ...(equipmentData.safetyFacilityLocations !== undefined && { safetyFacilityLocations: equipmentData.safetyFacilityLocations }),
      ...(equipmentData.emergencyContacts !== undefined && { emergencyContacts: equipmentData.emergencyContacts }),
      ...(equipmentData.requiredSafetyEquipment !== undefined && { requiredSafetyEquipment: equipmentData.requiredSafetyEquipment }),
      ...(equipmentData.safetyDeviceImages !== undefined && { safetyDeviceImages: equipmentData.safetyDeviceImages }),
      ...(equipmentData.hazardousChemicalType !== undefined && { hazardousChemicalType: equipmentData.hazardousChemicalType }),
      ...(equipmentData.hazardousChemicalName !== undefined && { hazardousChemicalName: equipmentData.hazardousChemicalName }),
      ...(equipmentData.msdsImageUrl !== undefined && { msdsImageUrl: equipmentData.msdsImageUrl }),
      updatedAt: new Date()
    };
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

  async updateIncident(id: number, incidentData: Partial<InsertIncident>): Promise<Incident> {
    const existing = this.incidents.get(id);
    if (!existing) throw new Error(`Incident with id ${id} not found`);
    
    const updated = { ...existing, ...incidentData };
    this.incidents.set(id, updated);
    return updated;
  }

  async deleteIncident(id: number): Promise<void> {
    this.incidents.delete(id);
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

  // Work schedules operations
  async createWorkSchedule(scheduleData: InsertWorkSchedule): Promise<WorkSchedule> {
    const id = this.currentId++;
    const newSchedule: WorkSchedule = {
      id,
      ...scheduleData,
      createdAt: new Date()
    };
    this.workSchedules.set(id, newSchedule);
    return newSchedule;
  }

  async getWorkSchedulesByDate(date: string): Promise<WorkSchedule[]> {
    const targetDate = new Date(date);
    return Array.from(this.workSchedules.values())
      .filter(ws => {
        const scheduleDate = new Date(ws.scheduledDate);
        return scheduleDate.toDateString() === targetDate.toDateString();
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }

  async getWorkScheduleById(id: number): Promise<WorkSchedule | undefined> {
    return this.workSchedules.get(id);
  }

  async updateWorkSchedule(id: number, scheduleData: Partial<WorkSchedule>): Promise<WorkSchedule> {
    const existing = this.workSchedules.get(id);
    if (!existing) throw new Error(`WorkSchedule with id ${id} not found`);
    
    const updated = { ...existing, ...scheduleData };
    this.workSchedules.set(id, updated);
    return updated;
  }

  async deleteWorkSchedule(id: number): Promise<void> {
    this.workSchedules.delete(id);
  }

  // Safety briefings operations
  async createSafetyBriefing(briefingData: InsertSafetyBriefing): Promise<SafetyBriefing> {
    const id = this.currentId++;
    const newBriefing: SafetyBriefing = {
      id,
      ...briefingData,
      createdAt: new Date()
    };
    this.safetyBriefings.set(id, newBriefing);
    return newBriefing;
  }

  async getSafetyBriefingByWorkScheduleId(workScheduleId: number): Promise<SafetyBriefing | undefined> {
    return Array.from(this.safetyBriefings.values())
      .find(sb => sb.workScheduleId === workScheduleId);
  }

  async updateSafetyBriefing(id: number, briefingData: Partial<SafetyBriefing>): Promise<SafetyBriefing> {
    const existing = this.safetyBriefings.get(id);
    if (!existing) throw new Error(`SafetyBriefing with id ${id} not found`);
    
    const updated = { ...existing, ...briefingData };
    this.safetyBriefings.set(id, updated);
    return updated;
  }
}

// Create storage instance
// Use memory storage temporarily until database issue is resolved
// import { DatabaseStorage } from "./database-storage-simple";
// export const storage = new DatabaseStorage();
export const storage = new MemStorage();