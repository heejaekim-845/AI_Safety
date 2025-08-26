import { db } from "./db";
import { eq, and, gte, lt } from "drizzle-orm";
import {
  equipment,
  workTypes,
  workProcedures,
  incidents,
  workSessions,
  riskReports,
  workSchedules,
  safetyBriefings,
} from "@shared/schema";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Equipment operations
  async getAllEquipment() {
    try {
      const result = await db.select().from(equipment);
      return result as any[];
    } catch (error) {
      console.error('Database error in getAllEquipment:', error);
      return [];
    }
  }

  async getEquipmentById(id: number) {
    try {
      const [result] = await db.select().from(equipment).where(eq(equipment.id, id));
      return result || undefined;
    } catch (error) {
      console.error('Database error in getEquipmentById:', error);
      return undefined;
    }
  }

  async getEquipmentByCode(code: string) {
    try {
      const [result] = await db.select().from(equipment).where(eq(equipment.code, code));
      return result || undefined;
    } catch (error) {
      console.error('Database error in getEquipmentByCode:', error);
      return undefined;
    }
  }

  async createEquipment(equipmentData: any) {
    try {
      const [result] = await db.insert(equipment).values(equipmentData).returning();
      return result;
    } catch (error) {
      console.error('Database error in createEquipment:', error);
      throw error;
    }
  }

  async updateEquipment(id: number, equipmentData: any) {
    try {
      const [result] = await db
        .update(equipment)
        .set({ ...equipmentData, updatedAt: new Date() })
        .where(eq(equipment.id, id))
        .returning();
      
      if (!result) throw new Error(`Equipment with id ${id} not found`);
      return result;
    } catch (error) {
      console.error('Database error in updateEquipment:', error);
      throw error;
    }
  }

  async deleteEquipment(id: number) {
    try {
      await db.delete(equipment).where(eq(equipment.id, id));
    } catch (error) {
      console.error('Database error in deleteEquipment:', error);
      throw error;
    }
  }

  // Work types operations
  async getWorkTypesByEquipmentId(equipmentId: number) {
    try {
      return await db.select().from(workTypes).where(eq(workTypes.equipmentId, equipmentId));
    } catch (error) {
      console.error('Database error in getWorkTypesByEquipmentId:', error);
      return [];
    }
  }

  async getWorkTypeById(id: number) {
    try {
      const [result] = await db.select().from(workTypes).where(eq(workTypes.id, id));
      return result || undefined;
    } catch (error) {
      console.error('Database error in getWorkTypeById:', error);
      return undefined;
    }
  }

  async createWorkType(workTypeData: any) {
    try {
      const [result] = await db.insert(workTypes).values(workTypeData).returning();
      return result;
    } catch (error) {
      console.error('Database error in createWorkType:', error);
      throw error;
    }
  }

  async updateWorkType(id: number, workTypeData: any) {
    try {
      const [result] = await db
        .update(workTypes)
        .set(workTypeData)
        .where(eq(workTypes.id, id))
        .returning();
      
      if (!result) throw new Error(`WorkType with id ${id} not found`);
      return result;
    } catch (error) {
      console.error('Database error in updateWorkType:', error);
      throw error;
    }
  }

  async deleteWorkType(id: number) {
    try {
      await db.delete(workTypes).where(eq(workTypes.id, id));
    } catch (error) {
      console.error('Database error in deleteWorkType:', error);
      throw error;
    }
  }

  // Work procedures operations
  async getProceduresByWorkTypeId(workTypeId: number) {
    try {
      return await db.select().from(workProcedures).where(eq(workProcedures.workTypeId, workTypeId));
    } catch (error) {
      console.error('Database error in getProceduresByWorkTypeId:', error);
      return [];
    }
  }

  async createWorkProcedure(procedureData: any) {
    try {
      const [result] = await db.insert(workProcedures).values(procedureData).returning();
      return result;
    } catch (error) {
      console.error('Database error in createWorkProcedure:', error);
      throw error;
    }
  }

  async updateWorkProcedure(id: number, procedureData: any) {
    try {
      const [result] = await db
        .update(workProcedures)
        .set(procedureData)
        .where(eq(workProcedures.id, id))
        .returning();
      
      if (!result) throw new Error(`WorkProcedure with id ${id} not found`);
      return result;
    } catch (error) {
      console.error('Database error in updateWorkProcedure:', error);
      throw error;
    }
  }

  async deleteWorkProcedure(id: number) {
    try {
      await db.delete(workProcedures).where(eq(workProcedures.id, id));
    } catch (error) {
      console.error('Database error in deleteWorkProcedure:', error);
      throw error;
    }
  }

  // Incidents operations
  async getIncidentsByEquipmentId(equipmentId: number) {
    try {
      return await db.select().from(incidents).where(eq(incidents.equipmentId, equipmentId));
    } catch (error) {
      console.error('Database error in getIncidentsByEquipmentId:', error);
      return [];
    }
  }

  async getIncidentsByWorkTypeId(workTypeId: number) {
    try {
      return await db.select().from(incidents).where(eq(incidents.workTypeId, workTypeId));
    } catch (error) {
      console.error('Database error in getIncidentsByWorkTypeId:', error);
      return [];
    }
  }

  async createIncident(incidentData: any) {
    try {
      const [result] = await db.insert(incidents).values(incidentData).returning();
      return result;
    } catch (error) {
      console.error('Database error in createIncident:', error);
      throw error;
    }
  }

  async updateIncident(id: number, incidentData: any) {
    try {
      const [result] = await db
        .update(incidents)
        .set(incidentData)
        .where(eq(incidents.id, id))
        .returning();
      
      if (!result) throw new Error(`Incident with id ${id} not found`);
      return result;
    } catch (error) {
      console.error('Database error in updateIncident:', error);
      throw error;
    }
  }

  async deleteIncident(id: number) {
    try {
      await db.delete(incidents).where(eq(incidents.id, id));
    } catch (error) {
      console.error('Database error in deleteIncident:', error);
      throw error;
    }
  }

  // Work sessions operations
  async createWorkSession(sessionData: any) {
    try {
      const [result] = await db.insert(workSessions).values(sessionData).returning();
      return result;
    } catch (error) {
      console.error('Database error in createWorkSession:', error);
      throw error;
    }
  }

  async getWorkSessionById(id: number) {
    try {
      const [result] = await db.select().from(workSessions).where(eq(workSessions.id, id));
      return result || undefined;
    } catch (error) {
      console.error('Database error in getWorkSessionById:', error);
      return undefined;
    }
  }

  async updateWorkSession(id: number, sessionData: any) {
    try {
      const [result] = await db
        .update(workSessions)
        .set(sessionData)
        .where(eq(workSessions.id, id))
        .returning();
      
      if (!result) throw new Error(`WorkSession with id ${id} not found`);
      return result;
    } catch (error) {
      console.error('Database error in updateWorkSession:', error);
      throw error;
    }
  }

  async getActiveWorkSessions() {
    try {
      return await db.select().from(workSessions);
    } catch (error) {
      console.error('Database error in getActiveWorkSessions:', error);
      return [];
    }
  }

  // Risk reports operations
  async createRiskReport(reportData: any) {
    try {
      const [result] = await db.insert(riskReports).values(reportData).returning();
      return result;
    } catch (error) {
      console.error('Database error in createRiskReport:', error);
      throw error;
    }
  }

  async getRiskReportsByEquipmentId(equipmentId: number) {
    try {
      return await db.select().from(riskReports).where(eq(riskReports.equipmentId, equipmentId));
    } catch (error) {
      console.error('Database error in getRiskReportsByEquipmentId:', error);
      return [];
    }
  }

  // Work schedules operations
  async createWorkSchedule(scheduleData: any) {
    try {
      const [result] = await db.insert(workSchedules).values(scheduleData).returning();
      return result;
    } catch (error) {
      console.error('Database error in createWorkSchedule:', error);
      throw error;
    }
  }

  async getAllWorkSchedules() {
    try {
      const result = await db
        .select({
          id: workSchedules.id,
          equipmentId: workSchedules.equipmentId,
          workTypeId: workSchedules.workTypeId,
          scheduledDate: workSchedules.scheduledDate,
          briefingTime: workSchedules.briefingTime,
          workerName: workSchedules.workerName,
          workLocation: workSchedules.workLocation,
          specialNotes: workSchedules.specialNotes,
          status: workSchedules.status,
          createdAt: workSchedules.createdAt,
          equipmentName: equipment.name,
          workTypeName: workTypes.name,
        })
        .from(workSchedules)
        .leftJoin(equipment, eq(workSchedules.equipmentId, equipment.id))
        .leftJoin(workTypes, eq(workSchedules.workTypeId, workTypes.id));
      
      return result;
    } catch (error) {
      console.error('Database error in getAllWorkSchedules:', error);
      return [];
    }
  }

  async getWorkSchedulesByDate(date: string) {
    try {
      // Parse the date string to ensure we filter by the exact date
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
      
      const result = await db
        .select({
          id: workSchedules.id,
          equipmentId: workSchedules.equipmentId,
          workTypeId: workSchedules.workTypeId,
          scheduledDate: workSchedules.scheduledDate,
          briefingTime: workSchedules.briefingTime,
          workerName: workSchedules.workerName,
          workLocation: workSchedules.workLocation,
          specialNotes: workSchedules.specialNotes,
          status: workSchedules.status,
          createdAt: workSchedules.createdAt,
          equipmentName: equipment.name,
          workTypeName: workTypes.name,
        })
        .from(workSchedules)
        .leftJoin(equipment, eq(workSchedules.equipmentId, equipment.id))
        .leftJoin(workTypes, eq(workSchedules.workTypeId, workTypes.id))
        .where(
          and(
            gte(workSchedules.scheduledDate, startOfDay),
            lt(workSchedules.scheduledDate, endOfDay)
          )
        );
      
      return result;
    } catch (error) {
      console.error('Database error in getWorkSchedulesByDate:', error);
      return [];
    }
  }

  async getWorkScheduleById(id: number) {
    try {
      const [result] = await db
        .select({
          id: workSchedules.id,
          equipmentId: workSchedules.equipmentId,
          workTypeId: workSchedules.workTypeId,
          scheduledDate: workSchedules.scheduledDate,
          briefingTime: workSchedules.briefingTime,
          workerName: workSchedules.workerName,
          workLocation: workSchedules.workLocation,
          specialNotes: workSchedules.specialNotes,
          status: workSchedules.status,
          createdAt: workSchedules.createdAt,
          equipmentName: equipment.name,
          workTypeName: workTypes.name,
        })
        .from(workSchedules)
        .leftJoin(equipment, eq(workSchedules.equipmentId, equipment.id))
        .leftJoin(workTypes, eq(workSchedules.workTypeId, workTypes.id))
        .where(eq(workSchedules.id, id));
      
      return result || undefined;
    } catch (error) {
      console.error('Database error in getWorkScheduleById:', error);
      return undefined;
    }
  }

  async updateWorkSchedule(id: number, scheduleData: any) {
    try {
      const [result] = await db
        .update(workSchedules)
        .set(scheduleData)
        .where(eq(workSchedules.id, id))
        .returning();
      
      if (!result) throw new Error(`WorkSchedule with id ${id} not found`);
      return result;
    } catch (error) {
      console.error('Database error in updateWorkSchedule:', error);
      throw error;
    }
  }

  async deleteWorkSchedule(id: number) {
    try {
      // First delete related safety briefings
      const deletedBriefings = await db.delete(safetyBriefings).where(eq(safetyBriefings.workScheduleId, id));
      console.log(`Deleted ${deletedBriefings} safety briefings for work schedule ${id}`);
      
      // Then delete the work schedule
      const deletedSchedule = await db.delete(workSchedules).where(eq(workSchedules.id, id));
      console.log(`Deleted work schedule ${id}`);
    } catch (error) {
      console.error('Database error in deleteWorkSchedule:', error);
      throw error;
    }
  }

  // Safety briefings operations
  async createSafetyBriefing(briefingData: any) {
    try {
      const [result] = await db.insert(safetyBriefings).values(briefingData).returning();
      return result;
    } catch (error) {
      console.error('Database error in createSafetyBriefing:', error);
      throw error;
    }
  }

  async getSafetyBriefingByWorkScheduleId(workScheduleId: number) {
    try {
      const [result] = await db.select().from(safetyBriefings).where(eq(safetyBriefings.workScheduleId, workScheduleId));
      return result || undefined;
    } catch (error) {
      console.error('Database error in getSafetyBriefingByWorkScheduleId:', error);
      return undefined;
    }
  }

  async updateSafetyBriefing(id: number, briefingData: any) {
    try {
      const [result] = await db
        .update(safetyBriefings)
        .set(briefingData)
        .where(eq(safetyBriefings.id, id))
        .returning();
      
      if (!result) throw new Error(`SafetyBriefing with id ${id} not found`);
      return result;
    } catch (error) {
      console.error('Database error in updateSafetyBriefing:', error);
      throw error;
    }
  }
}