import { db } from "./db";
import { eq, and } from "drizzle-orm";
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
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Equipment operations
  async getAllEquipment(): Promise<Equipment[]> {
    return await db.select().from(equipment);
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    const [result] = await db.select().from(equipment).where(eq(equipment.id, id));
    return result || undefined;
  }

  async getEquipmentByCode(code: string): Promise<Equipment | undefined> {
    const [result] = await db.select().from(equipment).where(eq(equipment.code, code));
    return result || undefined;
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [result] = await db
      .insert(equipment)
      .values(equipmentData)
      .returning();
    return result;
  }

  async updateEquipment(id: number, equipmentData: Partial<InsertEquipment>): Promise<Equipment> {
    const [result] = await db
      .update(equipment)
      .set({ ...equipmentData, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning();
    
    if (!result) throw new Error(`Equipment with id ${id} not found`);
    return result;
  }

  async deleteEquipment(id: number): Promise<void> {
    await db.delete(equipment).where(eq(equipment.id, id));
  }

  // Work types operations
  async getWorkTypesByEquipmentId(equipmentId: number): Promise<WorkType[]> {
    return await db.select().from(workTypes).where(eq(workTypes.equipmentId, equipmentId));
  }

  async getWorkTypeById(id: number): Promise<WorkType | undefined> {
    const [result] = await db.select().from(workTypes).where(eq(workTypes.id, id));
    return result || undefined;
  }

  async createWorkType(workTypeData: InsertWorkType): Promise<WorkType> {
    const [result] = await db
      .insert(workTypes)
      .values(workTypeData)
      .returning();
    return result;
  }

  async updateWorkType(id: number, workTypeData: Partial<InsertWorkType>): Promise<WorkType> {
    const [result] = await db
      .update(workTypes)
      .set(workTypeData)
      .where(eq(workTypes.id, id))
      .returning();
    
    if (!result) throw new Error(`WorkType with id ${id} not found`);
    return result;
  }

  async deleteWorkType(id: number): Promise<void> {
    await db.delete(workTypes).where(eq(workTypes.id, id));
  }

  // Work procedures operations
  async getProceduresByWorkTypeId(workTypeId: number): Promise<WorkProcedure[]> {
    return await db.select().from(workProcedures).where(eq(workProcedures.workTypeId, workTypeId));
  }

  async createWorkProcedure(procedureData: InsertWorkProcedure): Promise<WorkProcedure> {
    const [result] = await db
      .insert(workProcedures)
      .values(procedureData)
      .returning();
    return result;
  }

  async updateWorkProcedure(id: number, procedureData: Partial<InsertWorkProcedure>): Promise<WorkProcedure> {
    const [result] = await db
      .update(workProcedures)
      .set(procedureData)
      .where(eq(workProcedures.id, id))
      .returning();
    
    if (!result) throw new Error(`WorkProcedure with id ${id} not found`);
    return result;
  }

  async deleteWorkProcedure(id: number): Promise<void> {
    await db.delete(workProcedures).where(eq(workProcedures.id, id));
  }

  // Incidents operations
  async getIncidentsByEquipmentId(equipmentId: number): Promise<Incident[]> {
    return await db.select().from(incidents).where(eq(incidents.equipmentId, equipmentId));
  }

  async getIncidentsByWorkTypeId(workTypeId: number): Promise<Incident[]> {
    return await db.select().from(incidents).where(eq(incidents.workTypeId, workTypeId));
  }

  async createIncident(incidentData: InsertIncident): Promise<Incident> {
    const [result] = await db
      .insert(incidents)
      .values(incidentData)
      .returning();
    return result;
  }

  async updateIncident(id: number, incidentData: Partial<InsertIncident>): Promise<Incident> {
    const [result] = await db
      .update(incidents)
      .set(incidentData)
      .where(eq(incidents.id, id))
      .returning();
    
    if (!result) throw new Error(`Incident with id ${id} not found`);
    return result;
  }

  async deleteIncident(id: number): Promise<void> {
    await db.delete(incidents).where(eq(incidents.id, id));
  }

  // Work sessions operations
  async createWorkSession(sessionData: InsertWorkSession): Promise<WorkSession> {
    const [result] = await db
      .insert(workSessions)
      .values(sessionData)
      .returning();
    return result;
  }

  async getWorkSessionById(id: number): Promise<WorkSession | undefined> {
    const [result] = await db.select().from(workSessions).where(eq(workSessions.id, id));
    return result || undefined;
  }

  async updateWorkSession(id: number, sessionData: Partial<WorkSession>): Promise<WorkSession> {
    const [result] = await db
      .update(workSessions)
      .set(sessionData)
      .where(eq(workSessions.id, id))
      .returning();
    
    if (!result) throw new Error(`WorkSession with id ${id} not found`);
    return result;
  }

  async getActiveWorkSessions(): Promise<WorkSession[]> {
    return await db.select().from(workSessions);
  }

  // Risk reports operations
  async createRiskReport(reportData: InsertRiskReport): Promise<RiskReport> {
    const [result] = await db
      .insert(riskReports)
      .values(reportData)
      .returning();
    return result;
  }

  async getRiskReportsByEquipmentId(equipmentId: number): Promise<RiskReport[]> {
    return await db.select().from(riskReports).where(eq(riskReports.equipmentId, equipmentId));
  }

  // Work schedules operations
  async createWorkSchedule(scheduleData: InsertWorkSchedule): Promise<WorkSchedule> {
    const [result] = await db
      .insert(workSchedules)
      .values(scheduleData)
      .returning();
    return result;
  }

  async getWorkSchedulesByDate(date: string): Promise<WorkSchedule[]> {
    const targetDate = new Date(date);
    return await db.select().from(workSchedules);
  }

  async getWorkScheduleById(id: number): Promise<WorkSchedule | undefined> {
    const [result] = await db.select().from(workSchedules).where(eq(workSchedules.id, id));
    return result || undefined;
  }

  async updateWorkSchedule(id: number, scheduleData: Partial<WorkSchedule>): Promise<WorkSchedule> {
    const [result] = await db
      .update(workSchedules)
      .set(scheduleData)
      .where(eq(workSchedules.id, id))
      .returning();
    
    if (!result) throw new Error(`WorkSchedule with id ${id} not found`);
    return result;
  }

  async deleteWorkSchedule(id: number): Promise<void> {
    await db.delete(workSchedules).where(eq(workSchedules.id, id));
  }

  // Safety briefings operations
  async createSafetyBriefing(briefingData: InsertSafetyBriefing): Promise<SafetyBriefing> {
    const [result] = await db
      .insert(safetyBriefings)
      .values(briefingData)
      .returning();
    return result;
  }

  async getSafetyBriefingByWorkScheduleId(workScheduleId: number): Promise<SafetyBriefing | undefined> {
    const [result] = await db.select().from(safetyBriefings).where(eq(safetyBriefings.workScheduleId, workScheduleId));
    return result || undefined;
  }

  async updateSafetyBriefing(id: number, briefingData: Partial<SafetyBriefing>): Promise<SafetyBriefing> {
    const [result] = await db
      .update(safetyBriefings)
      .set(briefingData)
      .where(eq(safetyBriefings.id, id))
      .returning();
    
    if (!result) throw new Error(`SafetyBriefing with id ${id} not found`);
    return result;
  }
}