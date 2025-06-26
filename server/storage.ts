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
  type InsertRiskReport
} from "@shared/schema";

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
      location: "1공장 동쪽 구역",
      manufacturer: "삼성중공업",
      installYear: 2020,
      specification: "용량: 500L/min, 압력: 15bar",
      imageUrl: "/attached_assets/air-compressor-solution_1750831656695.jpg",
      modelName: "SC-500-15",
      blueprintInfo: "도면번호: DWG-COMP-A101-2020",
      riskLevel: "YELLOW",
      highVoltageRisk: false,
      highPressureRisk: true,
      highTemperatureRisk: true,
      heightRisk: false,
      heavyWeightRisk: true,
      hazardousChemicalType: "압축가스",
      hazardousChemicalName: "질소가스",
      riskManagementZone: "일반관리구역",
      requiredSafetyEquipment: ["안전모", "보안경", "내열장갑", "안전화"],
      lotoPoints: [
        { id: "LOTO-001", location: "주전원 차단기", type: "전기" },
        { id: "LOTO-002", location: "메인 밸브", type: "압력" }
      ],
      safetyFacilityLocations: [
        { id: "SF-001", type: "소화기", location: "장비 좌측 3m" },
        { id: "SF-002", type: "비상정지버튼", location: "제어패널" }
      ],
      emergencyContacts: [
        { role: "안전관리자", name: "김안전", phone: "010-1234-5678" },
        { role: "기술지원", name: "이기술", phone: "010-9876-5432" }
      ],
      safetyDeviceImages: ["/attached_assets/svalve_1750838843504.jpg"],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.equipment.set(1, sampleEquipment);

    // Add second sample equipment - Boiler B-102
    const sampleEquipment2: Equipment = {
      id: 2,
      name: "보일러 B-102",
      code: "BOILER-B-102",
      location: "보일러실 2층",
      manufacturer: "한국보일러공업",
      installYear: 2019,
      specification: "최대압력: 10kg/cm², 증기량: 5000kg/h",
      imageUrl: null,
      modelName: "KB-5000",
      blueprintInfo: "도면번호: DWG-BOILER-B102-2019",
      riskLevel: "RED",
      highVoltageRisk: true,
      highPressureRisk: true,
      highTemperatureRisk: true,
      heightRisk: false,
      heavyWeightRisk: false,
      hazardousChemicalType: "증기",
      hazardousChemicalName: "고온증기",
      riskManagementZone: "특별관리구역",
      requiredSafetyEquipment: ["내열복", "안전모", "보안경", "내열장갑", "안전화"],
      lotoPoints: [
        { id: "LOTO-003", location: "주증기밸브", type: "압력" },
        { id: "LOTO-004", location: "급수차단밸브", type: "압력" },
        { id: "LOTO-005", location: "연료차단밸브", type: "가스" },
        { id: "LOTO-006", location: "제어전원", type: "전기" }
      ],
      safetyFacilityLocations: [
        { id: "SF-003", type: "소화기", location: "보일러실 입구" },
        { id: "SF-004", type: "비상정지버튼", location: "제어실" },
        { id: "SF-005", type: "가스누출감지기", location: "연료공급라인" }
      ],
      emergencyContacts: [
        { role: "보일러기술자", name: "박보일", phone: "010-5678-9012" },
        { role: "안전관리자", name: "김안전", phone: "010-1234-5678" },
        { role: "소방서", name: "119", phone: "119" }
      ],
      safetyDeviceImages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.equipment.set(2, sampleEquipment2);

    // Sample work types
    const workType1: WorkType = {
      id: 1,
      equipmentId: 1,
      name: "일상 점검",
      description: "정기적인 설비 상태 확인 작업",
      requiresPermit: false,
      estimatedDuration: 30,
      requiredQualifications: ["기본 안전교육 이수"],
      requiredEquipment: ["점검표", "토크렌치"],
      environmentalRequirements: ["작업장 환기 양호", "조도 300lux 이상"],
      legalRequirements: ["일일점검 기록 작성"],
      createdAt: new Date()
    };

    const workType2: WorkType = {
      id: 2,
      equipmentId: 1,
      name: "정밀 점검",
      description: "상세한 설비 진단 및 측정 작업",
      requiresPermit: true,
      estimatedDuration: 120,
      requiredQualifications: ["압축기 전문교육 이수", "고압가스 취급 자격"],
      requiredEquipment: ["압력계", "온도계", "진동측정기"],
      environmentalRequirements: ["작업장 환기 양호", "주변 화기 제거"],
      legalRequirements: ["작업허가서 승인", "안전교육 이수 확인"],
      createdAt: new Date()
    };

    // Work types for Boiler B-102
    const workType3: WorkType = {
      id: 3,
      equipmentId: 2,
      name: "보일러 점화",
      description: "보일러 안전 점화 및 운전 준비",
      requiresPermit: true,
      estimatedDuration: 60,
      requiredQualifications: ["보일러기능사", "고압가스 안전교육"],
      requiredEquipment: ["압력계", "수위계", "점화장치"],
      environmentalRequirements: ["환기 상태 양호", "가스 누출 없음"],
      legalRequirements: ["점화 허가서", "안전작업 허가서"],
      createdAt: new Date()
    };

    const workType4: WorkType = {
      id: 4,
      equipmentId: 2,
      name: "보일러 정지",
      description: "보일러 안전 정지 및 점검",
      requiresPermit: false,
      estimatedDuration: 45,
      requiredQualifications: ["보일러운전자"],
      requiredEquipment: ["압력계", "온도계"],
      environmentalRequirements: ["작업 공간 확보"],
      legalRequirements: ["정지 절차서 준수"],
      createdAt: new Date()
    };

    this.workTypes.set(1, workType1);
    this.workTypes.set(2, workType2);
    this.workTypes.set(3, workType3);
    this.workTypes.set(4, workType4);

    // Sample procedures for 일상 점검
    const procedures: WorkProcedure[] = [
      {
        id: 1,
        workTypeId: 1,
        stepNumber: 1,
        category: "안전조치",
        title: "작업 준비",
        description: "작업 전 안전 장비 착용 및 주변 환경 점검",
        checklistItems: ["안전모 착용", "보안경 착용", "작업 구역 정리"],
        safetyNotes: "모든 안전 장비를 올바르게 착용했는지 확인하세요.",
        createdAt: new Date()
      },
      {
        id: 2,
        workTypeId: 1,
        stepNumber: 2,
        category: "상태인지",
        title: "외관 점검",
        description: "압축기 외부 상태 및 누출 여부 확인",
        checklistItems: ["외관 손상 확인", "오일 누출 점검", "볼트 체결 상태 확인"],
        safetyNotes: "누출 발견 시 즉시 작업을 중단하고 안전관리자에게 보고하세요.",
        createdAt: new Date()
      },
      {
        id: 3,
        workTypeId: 1,
        stepNumber: 3,
        category: "기기조작",
        title: "압력 확인",
        description: "시스템 압력 게이지 확인 및 기록",
        checklistItems: ["압력계 지시값 확인", "정상 범위 내 여부 판단", "기록표 작성"],
        safetyNotes: "압력이 정상 범위를 벗어나면 즉시 운전을 중단하세요.",
        createdAt: new Date()
      }
    ];

    procedures.forEach(proc => this.workProcedures.set(proc.id, proc));

    // Sample incidents
    const incident1: Incident = {
      id: 1,
      equipmentId: 1,
      workTypeId: 1,
      title: "압력 센서 이상",
      description: "일상 점검 중 압력 센서의 지시값 이상으로 경미한 누출 발생",
      severity: "MEDIUM",
      incidentDate: new Date("2024-01-15"),
      createdAt: new Date()
    };

    this.incidents.set(1, incident1);
    this.currentId = 10;
  }

  // Equipment operations
  async getAllEquipment(): Promise<Equipment[]> {
    console.log("Equipment in storage:", Array.from(this.equipment.keys()));
    return Array.from(this.equipment.values());
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    return this.equipment.get(id);
  }

  async getEquipmentByCode(code: string): Promise<Equipment | undefined> {
    return Array.from(this.equipment.values()).find(eq => eq.code === code);
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const id = this.currentId++;
    const newEquipment: Equipment = {
      id,
      name: equipmentData.name,
      code: equipmentData.code,
      location: equipmentData.location,
      manufacturer: equipmentData.manufacturer || null,
      installYear: equipmentData.installYear || null,
      specification: equipmentData.specification || null,
      modelName: equipmentData.modelName || null,
      blueprintInfo: equipmentData.blueprintInfo || null,
      riskLevel: equipmentData.riskLevel,
      highVoltageRisk: equipmentData.highVoltageRisk || false,
      highPressureRisk: equipmentData.highPressureRisk || false,
      highTemperatureRisk: equipmentData.highTemperatureRisk || false,
      heightRisk: equipmentData.heightRisk || false,
      heavyWeightRisk: equipmentData.heavyWeightRisk || false,
      hazardousChemicalType: equipmentData.hazardousChemicalType || null,
      hazardousChemicalName: equipmentData.hazardousChemicalName || null,
      riskManagementZone: equipmentData.riskManagementZone || null,
      requiredSafetyEquipment: equipmentData.requiredSafetyEquipment ? [...equipmentData.requiredSafetyEquipment] : null,
      lotoPoints: equipmentData.lotoPoints ? [...equipmentData.lotoPoints] : null,
      safetyFacilityLocations: equipmentData.safetyFacilityLocations ? [...equipmentData.safetyFacilityLocations] : null,
      emergencyContacts: equipmentData.emergencyContacts ? [...equipmentData.emergencyContacts] : null,
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
      name: workTypeData.name,
      equipmentId: workTypeData.equipmentId || null,
      description: workTypeData.description || null,
      requiresPermit: workTypeData.requiresPermit || null,
      estimatedDuration: workTypeData.estimatedDuration || null,
      requiredQualifications: workTypeData.requiredQualifications ? [...workTypeData.requiredQualifications] : null,
      requiredEquipment: workTypeData.requiredEquipment ? [...workTypeData.requiredEquipment] : null,
      environmentalRequirements: workTypeData.environmentalRequirements ? [...workTypeData.environmentalRequirements] : null,
      legalRequirements: workTypeData.legalRequirements ? [...workTypeData.legalRequirements] : null,
      createdAt: new Date()
    };
    this.workTypes.set(id, newWorkType);
    return newWorkType;
  }

  async updateWorkType(id: number, workTypeData: Partial<InsertWorkType>): Promise<WorkType> {
    const existing = this.workTypes.get(id);
    if (!existing) throw new Error(`Work type with id ${id} not found`);
    
    const updated = { ...existing, ...workTypeData };
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
      ...procedureData,
      id,
      createdAt: new Date()
    };
    this.workProcedures.set(id, newProcedure);
    return newProcedure;
  }

  async updateWorkProcedure(id: number, procedureData: Partial<InsertWorkProcedure>): Promise<WorkProcedure> {
    const existing = this.workProcedures.get(id);
    if (!existing) throw new Error(`Work procedure with id ${id} not found`);
    
    const updated = { ...existing, ...procedureData };
    this.workProcedures.set(id, updated);
    return updated;
  }

  async deleteWorkProcedure(id: number): Promise<void> {
    this.workProcedures.delete(id);
  }

  // Incidents operations
  async getIncidentsByEquipmentId(equipmentId: number): Promise<Incident[]> {
    return Array.from(this.incidents.values())
      .filter(inc => inc.equipmentId === equipmentId)
      .sort((a, b) => b.incidentDate.getTime() - a.incidentDate.getTime());
  }

  async getIncidentsByWorkTypeId(workTypeId: number): Promise<Incident[]> {
    return Array.from(this.incidents.values())
      .filter(inc => inc.workTypeId === workTypeId)
      .sort((a, b) => b.incidentDate.getTime() - a.incidentDate.getTime());
  }

  async createIncident(incidentData: InsertIncident): Promise<Incident> {
    const id = this.currentId++;
    const newIncident: Incident = {
      ...incidentData,
      id,
      createdAt: new Date()
    };
    this.incidents.set(id, newIncident);
    return newIncident;
  }

  // Work sessions operations
  async createWorkSession(sessionData: InsertWorkSession): Promise<WorkSession> {
    const id = this.currentId++;
    const newSession: WorkSession = {
      ...sessionData,
      id,
      completedSteps: sessionData.completedSteps || [],
      specialNotes: sessionData.specialNotes || [],
      startedAt: new Date(),
      completedAt: null
    };
    this.workSessions.set(id, newSession);
    return newSession;
  }

  async getWorkSessionById(id: number): Promise<WorkSession | undefined> {
    return this.workSessions.get(id);
  }

  async updateWorkSession(id: number, sessionData: Partial<WorkSession>): Promise<WorkSession> {
    const existing = this.workSessions.get(id);
    if (!existing) throw new Error(`Work session with id ${id} not found`);
    
    const updated = { ...existing, ...sessionData };
    this.workSessions.set(id, updated);
    return updated;
  }

  async getActiveWorkSessions(): Promise<WorkSession[]> {
    return Array.from(this.workSessions.values()).filter(ws => !ws.isCompleted);
  }

  // Risk reports operations
  async createRiskReport(reportData: InsertRiskReport): Promise<RiskReport> {
    const id = this.currentId++;
    const newReport: RiskReport = {
      ...reportData,
      id,
      createdAt: new Date()
    };
    this.riskReports.set(id, newReport);
    return newReport;
  }

  async getRiskReportsByEquipmentId(equipmentId: number): Promise<RiskReport[]> {
    return Array.from(this.riskReports.values())
      .filter(rr => rr.equipmentId === equipmentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const storage = new MemStorage();
