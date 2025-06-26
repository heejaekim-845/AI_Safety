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
  blueprintInfo: text("blueprint_info"),
  riskLevel: text("risk_level").notNull(), // RED, YELLOW, GREEN
  highVoltageRisk: boolean("high_voltage_risk").default(false),
  highPressureRisk: boolean("high_pressure_risk").default(false),
  highTemperatureRisk: boolean("high_temperature_risk").default(false),
  heightRisk: boolean("height_risk").default(false),
  heavyWeightRisk: boolean("heavy_weight_risk").default(false),
  hazardousChemicalType: text("hazardous_chemical_type"),
  hazardousChemicalName: text("hazardous_chemical_name"),
  riskManagementZone: text("risk_management_zone"),
  requiredSafetyEquipment: jsonb("required_safety_equipment").$type<string[]>(),
  lotoPoints: jsonb("loto_points").$type<{ id: string; location: string; type: string }[]>(),
  safetyFacilityLocations: jsonb("safety_facility_locations").$type<{ id: string; type: string; location: string }[]>(),
  emergencyContacts: jsonb("emergency_contacts").$type<{ role: string; name: string; phone: string }[]>(),
  safetyDeviceImages: jsonb("safety_device_images").$type<string[]>(),
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
  requiredQualifications: jsonb("required_qualifications").$type<string[]>(),
  requiredEquipment: jsonb("required_equipment").$type<string[]>(),
  environmentalRequirements: jsonb("environmental_requirements").$type<string[]>(),
  legalRequirements: jsonb("legal_requirements").$type<string[]>(),
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
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // HIGH, MEDIUM, LOW
  incidentDate: timestamp("incident_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Work sessions table (for tracking active work)
export const workSessions = pgTable("work_sessions", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  currentStep: integer("current_step").default(1),
  completedSteps: jsonb("completed_steps").$type<number[]>(),
  specialNotes: jsonb("special_notes").$type<{ stepId: number; note: string }[]>(),
  isCompleted: boolean("is_completed").default(false),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Risk reports table
export const riskReports = pgTable("risk_reports", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  workSessionId: integer("work_session_id").references(() => workSessions.id),
  riskDescription: text("risk_description").notNull(),
  severity: text("severity").notNull(),
  reportedBy: text("reported_by").notNull(),
  aiAnalysis: text("ai_analysis"),
  recommendations: jsonb("recommendations").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  startedAt: true,
  completedAt: true,
});

export const insertRiskReportSchema = createInsertSchema(riskReports).omit({
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
