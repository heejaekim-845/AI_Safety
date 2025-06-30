import { eq, and } from "drizzle-orm";
import { db } from "./db";
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
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Equipment operations
  async getAllEquipment(): Promise<Equipment[]> {
    return await db.select().from(equipment);
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    const [result] = await db.select().from(equipment).where(eq(equipment.id, id));
    return result;
  }

  async getEquipmentByCode(code: string): Promise<Equipment | undefined> {
    const [result] = await db.select().from(equipment).where(eq(equipment.code, code));
    return result;
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [result] = await db.insert(equipment).values({
      ...equipmentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result;
  }

  async updateEquipment(id: number, equipmentData: Partial<InsertEquipment>): Promise<Equipment> {
    const [result] = await db.update(equipment)
      .set({
        ...equipmentData,
        updatedAt: new Date(),
      })
      .where(eq(equipment.id, id))
      .returning();
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
    return result;
  }

  async createWorkType(workTypeData: InsertWorkType): Promise<WorkType> {
    const [result] = await db.insert(workTypes).values({
      ...workTypeData,
      createdAt: new Date(),
    }).returning();
    return result;
  }

  async updateWorkType(id: number, workTypeData: Partial<InsertWorkType>): Promise<WorkType> {
    const [result] = await db.update(workTypes)
      .set(workTypeData)
      .where(eq(workTypes.id, id))
      .returning();
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
    const [result] = await db.insert(workProcedures).values({
      ...procedureData,
      createdAt: new Date(),
    }).returning();
    return result;
  }

  async updateWorkProcedure(id: number, procedureData: Partial<InsertWorkProcedure>): Promise<WorkProcedure> {
    const [result] = await db.update(workProcedures)
      .set(procedureData)
      .where(eq(workProcedures.id, id))
      .returning();
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
    const [result] = await db.insert(incidents).values({
      ...incidentData,
      createdAt: new Date(),
    }).returning();
    return result;
  }

  // Work sessions operations
  async createWorkSession(sessionData: InsertWorkSession): Promise<WorkSession> {
    const [result] = await db.insert(workSessions).values({
      ...sessionData,
      createdAt: new Date(),
    }).returning();
    return result;
  }

  async getWorkSessionById(id: number): Promise<WorkSession | undefined> {
    const [result] = await db.select().from(workSessions).where(eq(workSessions.id, id));
    return result;
  }

  async updateWorkSession(id: number, sessionData: Partial<WorkSession>): Promise<WorkSession> {
    const [result] = await db.update(workSessions)
      .set(sessionData)
      .where(eq(workSessions.id, id))
      .returning();
    return result;
  }

  async getActiveWorkSessions(): Promise<WorkSession[]> {
    return await db.select().from(workSessions).where(eq(workSessions.status, 'in_progress'));
  }

  // Risk reports operations
  async createRiskReport(reportData: InsertRiskReport): Promise<RiskReport> {
    const [result] = await db.insert(riskReports).values({
      ...reportData,
      createdAt: new Date(),
    }).returning();
    return result;
  }

  async getRiskReportsByEquipmentId(equipmentId: number): Promise<RiskReport[]> {
    return await db.select().from(riskReports).where(eq(riskReports.equipmentId, equipmentId));
  }
}