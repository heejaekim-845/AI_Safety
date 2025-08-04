import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Equipment table
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  location: text("location").notNull(),
  manufacturer: text("manufacturer"),
  installYear: integer("install_year"),
  specification: text("specification"),
  imageUrl: text("image_url"),
  modelName: text("model_name"),
  riskLevel: text("risk_level").default("MEDIUM"),
  highTemperatureRisk: boolean("high_temperature").default(false),
  highTemperatureDetails: text("high_temperature_details"),
  highPressureRisk: boolean("high_pressure").default(false),
  highPressureDetails: text("high_pressure_details"),
  highVoltageRisk: boolean("electrical").default(false),
  highVoltageDetails: text("electrical_details"),
  heightRisk: boolean("fall_risk").default(false),
  heightDetails: text("fall_risk_details"),
  heavyWeightRisk: boolean("mechanical").default(false),
  heavyWeightDetails: text("mechanical_details"),
  riskFactors: jsonb("risk_factors").$type<{
    highVoltage?: boolean;
    highPressure?: boolean;
    highTemperature?: boolean;
    height?: boolean;
    mechanical?: boolean;
    highVoltageDetail?: string;
    highPressureDetail?: string;
    highTemperatureDetail?: string;
    heightDetail?: string;
    mechanicalDetail?: string;
  }>(),
  lotoPoints: jsonb("other_risks").$type<any[]>(),
  safetyFacilityLocations: jsonb("required_ppe").$type<any[]>(),
  emergencyContacts: jsonb("emergency_contacts"),
  requiredSafetyEquipment: jsonb("required_safety_equipment").$type<string[]>(),
  safetyDeviceImages: jsonb("safety_device_images").$type<any[]>(),
  hazardousChemicalType: text("hazardous_chemical_type"),
  hazardousChemicalName: text("hazardous_chemical_name"),
  msdsImageUrl: text("msds_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Work types table
export const workTypes = pgTable("work_types", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  name: text("name").notNull(),
  description: text("description"),
  requiresPermit: boolean("requires_permit").default(false),
  estimatedDuration: integer("estimated_duration"), // in minutes
  requiredQualifications: text("required_qualifications").array(),
  requiredEquipment: text("required_equipment").array(),
  environmentalRequirements: text("environmental_requirements").array(),
  legalRequirements: text("legal_requirements").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Work procedures table
export const workProcedures = pgTable("work_procedures", {
  id: serial("id").primaryKey(),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  stepNumber: integer("step_number").notNull(),
  category: text("category").notNull(), // 기기조작, 상태인지, 안전조치
  title: text("title").notNull(),
  description: text("description").notNull(),
  checklistItems: jsonb("checklist_items").$type<string[]>(),
  safetyNotes: text("safety_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Incidents table
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // HIGH, MEDIUM, LOW
  reporterName: text("reporter_name").notNull(),
  incidentDate: timestamp("incident_date").defaultNow(),
  actionsTaken: text("actions_taken"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Work sessions table (for tracking active work)
export const workSessions = pgTable("work_sessions", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  workerName: text("worker_name").notNull(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  status: text("status").default("in_progress"),
  notes: text("notes"),
  safetyChecklistCompleted: boolean("safety_checklist_completed").default(false),
  currentStep: integer("current_step").default(1),
  completedSteps: integer("completed_steps").array(),
  specialNotes: jsonb("special_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Risk reports table
export const riskReports = pgTable("risk_reports", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  riskType: text("risk_type").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  likelihood: text("likelihood").notNull(),
  mitigationActions: jsonb("mitigation_actions").$type<string[]>(),
  reporterName: text("reporter_name").notNull(),
  status: text("status").default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Work schedules table
export const workSchedules = pgTable("work_schedules", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  scheduledDate: timestamp("scheduled_date").notNull(),
  briefingTime: text("briefing_time"), // HH:MM format
  workerName: text("worker_name").notNull(),
  specialNotes: text("special_notes"), // 특이사항
  status: text("status").default("scheduled"), // scheduled, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
});

// Safety briefings table
export const safetyBriefings = pgTable("safety_briefings", {
  id: serial("id").primaryKey(),
  workScheduleId: integer("work_schedule_id").references(() => workSchedules.id),
  weatherInfo: jsonb("weather_info"),
  workSummary: text("work_summary"),
  riskFactors: jsonb("risk_factors"),
  riskAssessment: jsonb("risk_assessment"),
  requiredTools: text("required_tools").array(),
  requiredSafetyEquipment: text("required_safety_equipment").array(),
  regulations: jsonb("regulations"),
  relatedIncidents: jsonb("related_incidents"),
  educationMaterials: jsonb("education_materials"),
  quizQuestions: jsonb("quiz_questions"),
  safetySlogan: text("safety_slogan"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  installYear: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return val;
  }).nullable(),
});

export const insertWorkTypeSchema = createInsertSchema(workTypes).omit({
  id: true,
  createdAt: true,
});

export const insertWorkProcedureSchema = createInsertSchema(workProcedures).omit({
  id: true,
  createdAt: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
});

export const insertWorkSessionSchema = createInsertSchema(workSessions).omit({
  id: true,
  createdAt: true,
});

export const insertRiskReportSchema = createInsertSchema(riskReports).omit({
  id: true,
  createdAt: true,
});

export const insertWorkScheduleSchema = createInsertSchema(workSchedules).omit({
  id: true,
  createdAt: true,
}).extend({
  scheduledDate: z.union([z.string(), z.date()]).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  }),
});

export const insertSafetyBriefingSchema = createInsertSchema(safetyBriefings).omit({
  id: true,
  createdAt: true,
});

// Types
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;

export type WorkType = typeof workTypes.$inferSelect;
export type InsertWorkType = z.infer<typeof insertWorkTypeSchema>;

export type WorkProcedure = typeof workProcedures.$inferSelect;
export type InsertWorkProcedure = z.infer<typeof insertWorkProcedureSchema>;

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;

export type WorkSession = typeof workSessions.$inferSelect;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;

export type RiskReport = typeof riskReports.$inferSelect;
export type InsertRiskReport = z.infer<typeof insertRiskReportSchema>;

export type WorkSchedule = typeof workSchedules.$inferSelect;
export type InsertWorkSchedule = z.infer<typeof insertWorkScheduleSchema>;

export type SafetyBriefing = typeof safetyBriefings.$inferSelect;
export type InsertSafetyBriefing = z.infer<typeof insertSafetyBriefingSchema>;
