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
    if (!result) return result;
    
    // Parse JSON strings back to arrays if needed
    const processedResult = { ...result };
    const arrayFields = ['requiredPpe', 'emergencyContacts', 'requiredSafetyEquipment', 'lotoPoints', 'safetyFacilityLocations', 'safetyDeviceImages'];
    
    for (const field of arrayFields) {
      const value = processedResult[field as keyof Equipment];
      if (typeof value === 'string') {
        try {
          processedResult[field as keyof Equipment] = JSON.parse(value);
        } catch (e) {
          // If parsing fails, keep the original value
        }
      }
    }
    
    return processedResult;
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
    // Handle array fields properly for PostgreSQL
    const updateData = { ...equipmentData };
    
    // Handle all array fields that might be empty
    if (updateData.safetyEquipment && Array.isArray(updateData.safetyEquipment)) {
      if (updateData.safetyEquipment.length === 0) {
        updateData.safetyEquipment = null;
      }
    }
    if (updateData.emergencyContacts && Array.isArray(updateData.emergencyContacts)) {
      if (updateData.emergencyContacts.length === 0) {
        updateData.emergencyContacts = null;
      }
    }
    if (updateData.chemicalInfo && Array.isArray(updateData.chemicalInfo)) {
      if (updateData.chemicalInfo.length === 0) {
        updateData.chemicalInfo = null;
      }
    }
    if (updateData.safetyDevices && Array.isArray(updateData.safetyDevices)) {
      if (updateData.safetyDevices.length === 0) {
        updateData.safetyDevices = null;
      }
    }
    if (updateData.safetyFacilities && Array.isArray(updateData.safetyFacilities)) {
      if (updateData.safetyFacilities.length === 0) {
        updateData.safetyFacilities = null;
      }
    }
    
    const [result] = await db.update(equipment)
      .set({
        ...updateData,
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
    // Handle array fields properly for PostgreSQL
    const insertData = { ...procedureData };
    if (insertData.checklistItems && Array.isArray(insertData.checklistItems)) {
      // Convert empty arrays to null for PostgreSQL compatibility
      if (insertData.checklistItems.length === 0) {
        insertData.checklistItems = null;
      }
    }
    
    const [result] = await db.insert(workProcedures).values({
      ...insertData,
      createdAt: new Date(),
    }).returning();
    return result;
  }

  async updateWorkProcedure(id: number, procedureData: Partial<InsertWorkProcedure>): Promise<WorkProcedure> {
    // Handle array fields properly for PostgreSQL
    const updateData = { ...procedureData };
    if (updateData.checklistItems && Array.isArray(updateData.checklistItems)) {
      // Convert empty arrays to null for PostgreSQL compatibility
      if (updateData.checklistItems.length === 0) {
        updateData.checklistItems = null;
      }
    }
    
    const [result] = await db.update(workProcedures)
      .set(updateData)
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
    // Filter out any fields that don't exist in the workSessions table
    const allowedFields = {
      equipmentId: sessionData.equipmentId,
      workTypeId: sessionData.workTypeId,
      workerName: sessionData.workerName,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      status: sessionData.status,
      notes: sessionData.notes,
      safetyChecklistCompleted: sessionData.safetyChecklistCompleted,
      currentStep: sessionData.currentStep,
      completedSteps: sessionData.completedSteps,
      specialNotes: sessionData.specialNotes,
    };
    
    // Remove undefined fields
    const updateData = Object.fromEntries(
      Object.entries(allowedFields).filter(([_, value]) => value !== undefined)
    );
    
    const [result] = await db.update(workSessions)
      .set(updateData)
      .where(eq(workSessions.id, id))
      .returning();
    return result;
  }

  async getActiveWorkSessions(): Promise<WorkSession[]> {
    return await db.select().from(workSessions).where(eq(workSessions.status, 'in_progress'));
  }

  // Risk reports operations
  async createRiskReport(reportData: InsertRiskReport): Promise<RiskReport> {
    // Handle array fields properly for PostgreSQL
    const insertData = { ...reportData };
    if (insertData.mitigationActions && Array.isArray(insertData.mitigationActions)) {
      // Convert empty arrays to null for PostgreSQL compatibility
      if (insertData.mitigationActions.length === 0) {
        insertData.mitigationActions = null;
      }
    }
    
    const [result] = await db.insert(riskReports).values({
      ...insertData,
      createdAt: new Date(),
    }).returning();
    return result;
  }

  async getRiskReportsByEquipmentId(equipmentId: number): Promise<RiskReport[]> {
    return await db.select().from(riskReports).where(eq(riskReports.equipmentId, equipmentId));
  }
}