import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { aiService } from "./ai-service";
import { weatherService } from "./weather-service";
import { simpleRagService as ragService } from "./simple-rag-service";
import { chromaDBService } from "./chromadb-service";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { 
  insertEquipmentSchema, 
  insertWorkTypeSchema, 
  insertWorkProcedureSchema,
  insertWorkSessionSchema,
  insertRiskReportSchema,
  insertIncidentSchema,
  insertWorkScheduleSchema,
  insertSafetyBriefingSchema
} from "@shared/schema";

// Multer 설정
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.json', '.txt', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('지원되지 않는 파일 형식입니다. (.json, .txt, .pdf만 허용)'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Equipment routes
  app.get("/api/equipment", async (req, res) => {
    try {
      const equipment = await storage.getAllEquipment();
      res.json(equipment);
    } catch (error) {
      console.error("설비 목록 조회 오류:", error);
      res.status(500).json({ message: "설비 목록을 불러올 수 없습니다." });
    }
  });

  app.get("/api/equipment/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const equipment = await storage.getEquipmentById(id);
      if (!equipment) {
        return res.status(404).json({ message: "설비를 찾을 수 없습니다." });
      }
      res.json(equipment);
    } catch (error) {
      console.error("설비 조회 오류:", error);
      res.status(500).json({ message: "설비 정보를 불러올 수 없습니다." });
    }
  });

  app.get("/api/equipment/code/:code", async (req, res) => {
    try {
      const equipment = await storage.getEquipmentByCode(req.params.code);
      if (!equipment) {
        return res.status(404).json({ message: "설비를 찾을 수 없습니다." });
      }
      res.json(equipment);
    } catch (error) {
      console.error("설비 조회 오류:", error);
      res.status(500).json({ message: "설비 정보를 불러올 수 없습니다." });
    }
  });

  app.post("/api/equipment", async (req, res) => {
    try {
      const equipmentData = insertEquipmentSchema.parse(req.body);
      const equipment = await storage.createEquipment(equipmentData);
      res.status(201).json(equipment);
    } catch (error) {
      console.error("설비 생성 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "설비를 생성할 수 없습니다." });
    }
  });

  // Remove duplicate PUT route - use PATCH instead

  app.patch("/api/equipment/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("PATCH 요청 데이터:", JSON.stringify(req.body, null, 2));
      
      // Parse and validate input data properly
      const processArrayField = (field: any) => {
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') {
          try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const transformedData = {
        ...req.body,
        // Ensure arrays are properly handled and parsed
        requiredSafetyEquipment: processArrayField(req.body.requiredSafetyEquipment),
        lotoPoints: processArrayField(req.body.lotoPoints),
        safetyFacilityLocations: processArrayField(req.body.safetyFacilityLocations),
        emergencyContacts: processArrayField(req.body.emergencyContacts),
        safetyDeviceImages: processArrayField(req.body.safetyDeviceImages),
        // Handle riskFactors object
        riskFactors: req.body.riskFactors || null,
        // Keep detail fields as they now exist in the schema
        highTemperatureDetails: req.body.highTemperatureDetails,
        highPressureDetails: req.body.highPressureDetails,
        highVoltageDetails: req.body.highVoltageDetails,
        heightDetails: req.body.heightDetails,
        heavyWeightDetails: req.body.heavyWeightDetails
      };
      
      console.log("변환된 데이터:", JSON.stringify(transformedData, null, 2));
      
      const equipmentData = insertEquipmentSchema.partial().parse(transformedData);
      console.log("검증된 설비 데이터:", JSON.stringify(equipmentData, null, 2));
      
      // AI 위험도 재평가 수행
      console.log("AI 위험도 재평가 시작...");
      try {
        const currentEquipment = await storage.getEquipmentById(id);
        console.log("현재 설비 정보:", currentEquipment?.name);
        if (currentEquipment) {
          const updatedEquipmentForAI = { ...currentEquipment, ...equipmentData };
          console.log("AI 평가용 설비 데이터 준비 완료");
          const aiRiskLevel = await aiService.evaluateEquipmentRiskLevel(updatedEquipmentForAI);
          console.log(`AI 위험도 평가 결과: ${aiRiskLevel}`);
          equipmentData.riskLevel = aiRiskLevel;
          console.log(`AI 위험도 평가 완료: ${updatedEquipmentForAI.name} -> ${aiRiskLevel}`);
        } else {
          console.log("현재 설비를 찾을 수 없음");
        }
      } catch (aiError) {
        console.error("AI 위험도 평가 실패:", aiError);
        console.error("AI 오류 스택:", String(aiError));
        // AI 평가 실패 시 기존 값 유지
      }
      
      const equipment = await storage.updateEquipment(id, equipmentData);
      console.log("업데이트 완료:", equipment);
      res.json(equipment);
    } catch (error) {
      console.error("설비 업데이트 오류:", error);
      console.error("오류 스택:", String(error));
      if (error instanceof z.ZodError) {
        console.error("Zod 검증 오류:", error.errors);
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "설비를 업데이트할 수 없습니다." });
    }
  });

  // Work types routes
  app.get("/api/equipment/:equipmentId/work-types", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const workTypes = await storage.getWorkTypesByEquipmentId(equipmentId);
      res.json(workTypes);
    } catch (error) {
      console.error("작업 유형 조회 오류:", error);
      res.status(500).json({ message: "작업 유형을 불러올 수 없습니다." });
    }
  });

  app.post("/api/work-types", async (req, res) => {
    try {
      const workTypeData = insertWorkTypeSchema.parse(req.body);
      const workType = await storage.createWorkType(workTypeData);
      res.status(201).json(workType);
    } catch (error) {
      console.error("작업 유형 생성 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "작업 유형을 생성할 수 없습니다." });
    }
  });

  app.patch("/api/work-types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workTypeData = insertWorkTypeSchema.partial().parse(req.body);
      const workType = await storage.updateWorkType(id, workTypeData);
      res.json(workType);
    } catch (error) {
      console.error("작업 유형 수정 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "작업 유형을 수정할 수 없습니다." });
    }
  });

  app.patch("/api/work-types/:id/checklist", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const checklistSchema = z.object({
        requiredQualifications: z.array(z.string()).optional(),
        requiredEquipment: z.array(z.string()).optional(),
        requiredTools: z.array(z.string()).optional(),
        environmentalRequirements: z.array(z.string()).optional(),
        legalRequirements: z.array(z.string()).optional(),
      });
      
      const checklistData = checklistSchema.parse(req.body);
      
      // Convert empty arrays to null for PostgreSQL compatibility
      const processedData = Object.fromEntries(
        Object.entries(checklistData).map(([key, value]) => [
          key,
          Array.isArray(value) && value.length === 0 ? null : value
        ])
      );
      
      const workType = await storage.updateWorkType(id, processedData);
      res.json(workType);
    } catch (error) {
      console.error("작업 전 점검사항 수정 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "작업 전 점검사항을 수정할 수 없습니다." });
    }
  });

  app.delete("/api/work-types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkType(id);
      res.status(204).send();
    } catch (error) {
      console.error("작업 유형 삭제 오류:", error);
      res.status(500).json({ message: "작업 유형을 삭제할 수 없습니다." });
    }
  });

  // Work procedures routes
  app.get("/api/work-types/:workTypeId/procedures", async (req, res) => {
    try {
      const workTypeId = parseInt(req.params.workTypeId);
      const procedures = await storage.getProceduresByWorkTypeId(workTypeId);
      res.json(procedures);
    } catch (error) {
      console.error("작업 절차 조회 오류:", error);
      res.status(500).json({ message: "작업 절차를 불러올 수 없습니다." });
    }
  });

  app.post("/api/work-procedures", async (req, res) => {
    try {
      // Preprocess array fields to handle empty string arrays properly
      const bodyData = { ...req.body };
      if (bodyData.checklistItems) {
        if (typeof bodyData.checklistItems === 'string') {
          try {
            bodyData.checklistItems = JSON.parse(bodyData.checklistItems);
          } catch {
            // If it's not valid JSON, treat as empty array
            bodyData.checklistItems = [];
          }
        }
        // Convert empty arrays to null for PostgreSQL compatibility
        if (Array.isArray(bodyData.checklistItems) && bodyData.checklistItems.length === 0) {
          bodyData.checklistItems = null;
        }
      }
      
      const procedureData = insertWorkProcedureSchema.parse(bodyData);
      const procedure = await storage.createWorkProcedure(procedureData);
      res.status(201).json(procedure);
    } catch (error) {
      console.error("작업 절차 생성 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "작업 절차를 생성할 수 없습니다." });
    }
  });

  app.patch("/api/work-procedures/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Preprocess array fields to handle empty string arrays properly
      const bodyData = { ...req.body };
      if (bodyData.checklistItems) {
        if (typeof bodyData.checklistItems === 'string') {
          try {
            bodyData.checklistItems = JSON.parse(bodyData.checklistItems);
          } catch {
            // If it's not valid JSON, treat as empty array
            bodyData.checklistItems = [];
          }
        }
        // Convert empty arrays to null for PostgreSQL compatibility
        if (Array.isArray(bodyData.checklistItems) && bodyData.checklistItems.length === 0) {
          bodyData.checklistItems = null;
        }
      }
      
      const procedureData = insertWorkProcedureSchema.partial().parse(bodyData);
      const procedure = await storage.updateWorkProcedure(id, procedureData);
      res.json(procedure);
    } catch (error) {
      console.error("작업 절차 수정 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "작업 절차를 수정할 수 없습니다." });
    }
  });

  app.delete("/api/work-procedures/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkProcedure(id);
      res.status(204).send();
    } catch (error) {
      console.error("작업 절차 삭제 오류:", error);
      res.status(500).json({ message: "작업 절차를 삭제할 수 없습니다." });
    }
  });

  // Incidents routes
  app.get("/api/equipment/:equipmentId/incidents", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const incidents = await storage.getIncidentsByEquipmentId(equipmentId);
      res.json(incidents);
    } catch (error) {
      console.error("사고 이력 조회 오류:", error);
      res.status(500).json({ message: "사고 이력을 불러올 수 없습니다." });
    }
  });

  app.get("/api/work-types/:workTypeId/incidents", async (req, res) => {
    try {
      const workTypeId = parseInt(req.params.workTypeId);
      const incidents = await storage.getIncidentsByWorkTypeId(workTypeId);
      res.json(incidents);
    } catch (error) {
      console.error("작업별 사고 이력 조회 오류:", error);
      res.status(500).json({ message: "작업별 사고 이력을 불러올 수 없습니다." });
    }
  });

  // Work sessions routes
  app.post("/api/work-sessions", async (req, res) => {
    try {
      const sessionData = insertWorkSessionSchema.parse(req.body);
      const session = await storage.createWorkSession(sessionData);
      res.status(201).json(session);
    } catch (error) {
      console.error("작업 세션 생성 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "작업 세션을 생성할 수 없습니다." });
    }
  });

  app.get("/api/work-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getWorkSessionById(id);
      if (!session) {
        return res.status(404).json({ message: "작업 세션을 찾을 수 없습니다." });
      }
      res.json(session);
    } catch (error) {
      console.error("작업 세션 조회 오류:", error);
      res.status(500).json({ message: "작업 세션을 불러올 수 없습니다." });
    }
  });

  app.put("/api/work-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.updateWorkSession(id, req.body);
      res.json(session);
    } catch (error) {
      console.error("작업 세션 업데이트 오류:", error);
      res.status(500).json({ message: "작업 세션을 업데이트할 수 없습니다." });
    }
  });

  // Risk reports routes
  app.post("/api/risk-reports", async (req, res) => {
    try {
      const reportData = insertRiskReportSchema.parse(req.body);
      
      // Get equipment info for AI analysis
      const equipment = await storage.getEquipmentById(reportData.equipmentId!);
      if (!equipment) {
        return res.status(404).json({ message: "설비를 찾을 수 없습니다." });
      }

      // AI analysis
      const aiAnalysis = await aiService.analyzeRiskReport(
        equipment,
        reportData.description,
        reportData.reporterName
      );

      const enrichedReport = {
        ...reportData,
        aiAnalysis: JSON.stringify(aiAnalysis),
        recommendations: aiAnalysis.recommendations
      };

      const report = await storage.createRiskReport(enrichedReport);
      res.status(201).json(report);
    } catch (error) {
      console.error("위험 보고서 생성 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "위험 보고서를 생성할 수 없습니다." });
    }
  });

  // Incidents routes
  app.post("/api/incidents", async (req, res) => {
    try {
      // Convert incidentDate string to Date object if provided
      const requestData = { ...req.body };
      if (requestData.incidentDate && typeof requestData.incidentDate === 'string') {
        requestData.incidentDate = new Date(requestData.incidentDate);
      }
      
      const validatedData = insertIncidentSchema.parse(requestData);
      const incident = await storage.createIncident(validatedData);
      res.status(201).json(incident);
    } catch (error) {
      console.error("사고 등록 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "사고를 등록할 수 없습니다." });
    }
  });

  app.put("/api/incidents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Convert incidentDate string to Date object if provided
      const requestData = { ...req.body };
      if (requestData.incidentDate && typeof requestData.incidentDate === 'string') {
        requestData.incidentDate = new Date(requestData.incidentDate);
      }
      
      const validatedData = insertIncidentSchema.partial().parse(requestData);
      const incident = await storage.updateIncident(id, validatedData);
      res.json(incident);
    } catch (error) {
      console.error("사고 수정 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "사고를 수정할 수 없습니다." });
    }
  });

  app.delete("/api/incidents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteIncident(id);
      res.status(204).send();
    } catch (error) {
      console.error("사고 삭제 오류:", error);
      res.status(500).json({ message: "사고를 삭제할 수 없습니다." });
    }
  });

  // AI services routes
  app.post("/api/ai/safety-analysis", async (req, res) => {
    try {
      const { equipmentId, workTypeId, specialNotes } = req.body;
      
      const equipment = await storage.getEquipmentById(equipmentId);
      const workType = await storage.getWorkTypeById(workTypeId);
      
      if (!equipment || !workType) {
        return res.status(404).json({ message: "설비 또는 작업 유형을 찾을 수 없습니다." });
      }

      const analysis = await aiService.analyzeSafetyConditions(equipment, workType, specialNotes);
      res.json(analysis);
    } catch (error) {
      console.error("AI 안전 분석 오류:", error);
      res.status(500).json({ message: "안전 분석을 수행할 수 없습니다." });
    }
  });

  app.post("/api/ai/voice-guide", async (req, res) => {
    try {
      const { equipmentId } = req.body;
      
      const equipment = await storage.getEquipmentById(equipmentId);
      if (!equipment) {
        return res.status(404).json({ message: "설비를 찾을 수 없습니다." });
      }

      const voiceGuide = await aiService.generateVoiceGuide(equipment);
      res.json({ guide: voiceGuide });
    } catch (error) {
      console.error("AI 음성 안내 생성 오류:", error);
      res.status(500).json({ message: "음성 안내를 생성할 수 없습니다." });
    }
  });

  app.post("/api/ai/analyze-step-note", async (req, res) => {
    try {
      const { stepNote, stepInfo, equipmentId, workTypeId } = req.body;
      
      if (!stepNote || !stepNote.trim()) {
        return res.status(400).json({ message: "특이사항 내용이 필요합니다." });
      }

      const equipment = await storage.getEquipmentById(equipmentId);
      if (!equipment) {
        return res.status(404).json({ message: "설비를 찾을 수 없습니다." });
      }

      // Get work type information for better context
      let workType = null;
      if (workTypeId) {
        workType = await storage.getWorkTypeById(workTypeId);
      }

      // Enhanced step info with work type context
      const enhancedStepInfo = {
        ...stepInfo,
        workType: workType?.name || "일반 작업",
        workDescription: workType?.description || "",
        category: stepInfo.category || workType?.name || "일반"
      };

      const analysis = await aiService.analyzeStepNote(stepNote, enhancedStepInfo, equipment);
      res.json(analysis);
    } catch (error) {
      console.error("특이사항 분석 오류:", error);
      res.status(500).json({ message: "특이사항 분석을 수행할 수 없습니다." });
    }
  });

  // AI work type risk assessment
  app.post('/api/ai/risk-assessment/:workTypeId', async (req, res) => {
    try {
      const workTypeId = parseInt(req.params.workTypeId);
      const workType = await storage.getWorkTypeById(workTypeId);
      
      if (!workType) {
        return res.status(404).json({ message: "Work type not found" });
      }

      const equipment = await storage.getEquipmentById(workType.equipmentId!);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      const assessment = await aiService.analyzeWorkTypeRisk(workTypeId, workType.name, equipment);
      res.json(assessment);
    } catch (error) {
      console.error("Work type risk assessment error:", error);
      res.status(500).json({ message: "Failed to perform risk assessment" });
    }
  });

  // Work schedules routes
  app.post("/api/work-schedules", async (req, res) => {
    try {
      const scheduleData = insertWorkScheduleSchema.parse(req.body);
      const schedule = await storage.createWorkSchedule(scheduleData);
      res.status(201).json(schedule);
    } catch (error) {
      console.error("작업 일정 생성 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "작업 일정을 생성할 수 없습니다." });
    }
  });

  app.get("/api/work-schedules", async (req, res) => {
    try {
      const date = req.query.date as string;
      if (!date) {
        return res.status(400).json({ message: "날짜가 필요합니다." });
      }
      const schedules = await storage.getWorkSchedulesByDate(date);
      res.json(schedules);
    } catch (error) {
      console.error("작업 일정 조회 오류:", error);
      res.status(500).json({ message: "작업 일정을 불러올 수 없습니다." });
    }
  });

  app.get("/api/work-schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = await storage.getWorkScheduleById(id);
      if (!schedule) {
        return res.status(404).json({ message: "작업 일정을 찾을 수 없습니다." });
      }
      res.json(schedule);
    } catch (error) {
      console.error("작업 일정 조회 오류:", error);
      res.status(500).json({ message: "작업 일정을 불러올 수 없습니다." });
    }
  });

  app.put("/api/work-schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const scheduleData = insertWorkScheduleSchema.partial().parse(req.body);
      const schedule = await storage.updateWorkSchedule(id, scheduleData);
      res.json(schedule);
    } catch (error) {
      console.error("작업 일정 수정 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "작업 일정을 수정할 수 없습니다." });
    }
  });

  app.delete("/api/work-schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkSchedule(id);
      res.status(204).send();
    } catch (error) {
      console.error("작업 일정 삭제 오류:", error);
      res.status(500).json({ message: "작업 일정을 삭제할 수 없습니다." });
    }
  });

  // Safety briefings routes  
  app.post("/api/safety-briefings", async (req, res) => {
    try {
      const briefingData = insertSafetyBriefingSchema.parse(req.body);
      const briefing = await storage.createSafetyBriefing(briefingData);
      res.status(201).json(briefing);
    } catch (error) {
      console.error("안전 브리핑 생성 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "안전 브리핑을 생성할 수 없습니다." });
    }
  });

  app.get("/api/safety-briefings/work-schedule/:workScheduleId", async (req, res) => {
    try {
      const workScheduleId = parseInt(req.params.workScheduleId);
      const briefing = await storage.getSafetyBriefingByWorkScheduleId(workScheduleId);
      if (!briefing) {
        return res.status(404).json({ message: "안전 브리핑을 찾을 수 없습니다." });
      }
      res.json(briefing);
    } catch (error) {
      console.error("안전 브리핑 조회 오류:", error);
      res.status(500).json({ message: "안전 브리핑을 불러올 수 없습니다." });
    }
  });

  app.put("/api/safety-briefings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const briefingData = insertSafetyBriefingSchema.partial().parse(req.body);
      const briefing = await storage.updateSafetyBriefing(id, briefingData);
      res.json(briefing);
    } catch (error) {
      console.error("안전 브리핑 수정 오류:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "입력 데이터가 올바르지 않습니다.", errors: error.errors });
      }
      res.status(500).json({ message: "안전 브리핑을 수정할 수 없습니다." });
    }
  });

  // Generate comprehensive safety briefing
  app.post("/api/generate-safety-briefing/:workScheduleId", async (req, res) => {
    try {
      const workScheduleId = parseInt(req.params.workScheduleId);
      
      // Get work schedule
      const workSchedule = await storage.getWorkScheduleById(workScheduleId);
      if (!workSchedule) {
        return res.status(404).json({ message: "작업 일정을 찾을 수 없습니다." });
      }

      // Get related data
      const equipment = await storage.getEquipmentById(workSchedule.equipmentId!);
      const workType = await storage.getWorkTypeById(workSchedule.workTypeId!);
      const registeredIncidents = await storage.getIncidentsByEquipmentId(workSchedule.equipmentId!);
      
      if (!equipment || !workType) {
        return res.status(404).json({ message: "설비 또는 작업 유형을 찾을 수 없습니다." });
      }

      // Services are imported at the top of the file

      // Get weather information using work location if available, otherwise use equipment location
      const weatherLocation = workSchedule.workLocation || equipment.location;
      let weatherInfo = null;
      
      try {
        weatherInfo = await weatherService.getWeatherForLocation(weatherLocation);
      } catch (error) {
        console.warn(`날씨 정보를 가져올 수 없습니다 (${weatherLocation}): ${String(error)}`);
        // weatherInfo remains null - no mock data will be used
      }

      // Generate comprehensive AI briefing with RAG integration
      const aiAnalysis = await aiService.generateEnhancedSafetyBriefing(
        equipment,
        workType,
        weatherInfo,
        workSchedule.specialNotes || undefined
      );

      // Create complete briefing data
      const briefingData = {
        workScheduleId,
        weatherInfo,
        workSummary: aiAnalysis.workSummary,
        riskFactors: aiAnalysis.riskFactors,
        riskAssessment: aiAnalysis.riskAssessment,
        requiredTools: aiAnalysis.requiredTools,
        requiredSafetyEquipment: aiAnalysis.requiredSafetyEquipment,
        regulations: aiAnalysis.regulations || [],
        relatedIncidents: aiAnalysis.relatedIncidents || [],
        educationMaterials: aiAnalysis.educationMaterials || [],
        quizQuestions: aiAnalysis.quizQuestions || [],
        safetySlogan: aiAnalysis.safetySlogan || "안전이 최우선입니다"
      };

      // Save to database
      const briefing = await storage.createSafetyBriefing(briefingData);

      res.json({
        briefing,
        weatherInfo,
        workSummary: aiAnalysis.workSummary,
        riskFactors: aiAnalysis.riskFactors,
        riskAssessment: aiAnalysis.riskAssessment,
        requiredTools: aiAnalysis.requiredTools,
        requiredSafetyEquipment: aiAnalysis.requiredSafetyEquipment,
        weatherConsiderations: aiAnalysis.weatherConsiderations || [],
        safetyRecommendations: aiAnalysis.safetyRecommendations || [],
        regulations: aiAnalysis.regulations || [],
        relatedIncidents: aiAnalysis.relatedIncidents || [], // RAG 검색 결과 (유사 사고사례)
        registeredIncidents: registeredIncidents || [], // 설비별 등록된 사고이력
        educationMaterials: aiAnalysis.educationMaterials || [],
        quizQuestions: aiAnalysis.quizQuestions || [],
        safetySlogan: aiAnalysis.safetySlogan || "안전이 최우선입니다",
        relatedAccidentCases: aiAnalysis.relatedAccidentCases || []
      });
    } catch (error) {
      console.error("안전 브리핑 생성 오류:", error);
      res.status(500).json({ message: "안전 브리핑을 생성할 수 없습니다." });
    }
  });

  // ChromaDB 임베디드 모드 테스트 엔드포인트
  app.get("/api/test-vector-db", async (req, res) => {
    try {
      console.log('ChromaDB 초기화 테스트 시작...');
      
      // ChromaDB 초기화
      await chromaDBService.initialize();
      
      // 테스트 검색 수행
      const results = await chromaDBService.searchRelevantData(
        "170kV GIS 정기점검",
        5
      );
      
      // 통계 정보 가져오기
      const stats = await chromaDBService.getStats();
      
      res.json({
        message: "ChromaDB 임베디드 모드 테스트 완료",
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        },
        searchResults: {
          found: results.length,
          results: results.map(r => ({
            type: r.metadata.type,
            title: r.metadata.title,
            distance: r.distance
          }))
        }
      });
    } catch (error: any) {
      console.error('ChromaDB 테스트 실패:', error);
      res.status(500).json({ 
        error: error.message,
        message: "ChromaDB 테스트 실패" 
      });
    }
  });

  // ChromaDB 사용자 정의 검색 테스트 엔드포인트 (POST)
  app.post("/api/test-vector-db", async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          message: "검색어를 입력해주세요",
          stats: { totalDocuments: 0, collections: [] },
          searchResults: { found: 0, results: [] }
        });
      }

      console.log(`사용자 정의 검색 테스트: "${query}"`);
      
      // ChromaDB 초기화
      await chromaDBService.initialize();
      
      // 사용자 정의 쿼리로 검색 수행
      const results = await chromaDBService.searchRelevantData(query.trim(), 5);
      
      // 통계 정보 가져오기
      const stats = await chromaDBService.getStats();
      
      res.json({
        message: `"${query}" 검색 완료`,
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        },
        searchResults: {
          found: results.length,
          results: results.map(r => ({
            type: r.metadata.type,
            title: r.metadata.title,
            distance: r.distance
          }))
        }
      });
    } catch (error: any) {
      console.error('사용자 정의 벡터 검색 실패:', error);
      res.status(500).json({ 
        error: error.message,
        message: "벡터 검색 실패",
        stats: { totalDocuments: 0, collections: [] },
        searchResults: { found: 0, results: [] }
      });
    }
  });

  // 벡터DB 상세 분석 엔드포인트
  app.get("/api/vector-db-analysis", async (req, res) => {
    try {
      console.log('벡터DB 상세 분석 시작...');
      
      // ChromaDB 초기화
      await chromaDBService.initialize();
      
      // 상세 분석 정보 가져오기
      const analysis = await chromaDBService.getDetailedAnalysis();
      
      res.json({
        message: "벡터DB 상세 분석 완료",
        ...analysis
      });
    } catch (error: any) {
      console.error('벡터DB 상세 분석 실패:', error);
      res.status(500).json({ 
        error: error.message,
        message: "벡터DB 상세 분석 실패",
        totalDocuments: 0,
        categoryBreakdown: {},
        industryBreakdown: {},
        workTypeBreakdown: {},
        sampleDocuments: []
      });
    }
  });

  // ChromaDB 카테고리별 검색 엔드포인트 (POST)
  app.post("/api/search-by-category", async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          message: "검색어를 입력해주세요",
          results: {
            education: [],
            incident: [],
            regulation: [],
            totalFound: { education: 0, incident: 0, regulation: 0 }
          }
        });
      }

      console.log(`카테고리별 검색: "${query}"`);
      
      // ChromaDB 초기화
      await chromaDBService.initialize();
      
      // 카테고리별 검색 수행
      const results = await chromaDBService.searchByCategory(query.trim(), 5);
      
      res.json({
        message: `"${query}" 카테고리별 검색 완료`,
        results: {
          education: results.education.map(r => ({
            type: r.metadata.type,
            title: r.metadata.title,
            content: r.metadata.content || r.document,
            distance: r.distance,
            metadata: r.metadata
          })),
          incident: results.incident.map(r => ({
            type: r.metadata.type,
            title: r.metadata.title,
            content: r.metadata.content || r.document,
            distance: r.distance,
            metadata: r.metadata
          })),
          regulation: results.regulation.map(r => ({
            type: r.metadata.type,
            title: r.metadata.title,
            content: r.metadata.content || r.document,
            distance: r.distance,
            metadata: r.metadata
          })),
          totalFound: results.totalFound
        }
      });
    } catch (error: any) {
      console.error('카테고리별 벡터 검색 실패:', error);
      res.status(500).json({ 
        error: error.message,
        message: "카테고리별 벡터 검색 실패",
        results: {
          education: [],
          incident: [],
          regulation: [],
          totalFound: { education: 0, incident: 0, regulation: 0 }
        }
      });
    }
  });

  // 특정 파일만 추가로 임베딩하는 엔드포인트
  app.post("/api/add-documents", async (req, res) => {
    try {
      const { filePaths } = req.body;
      
      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return res.status(400).json({
          success: false,
          message: "임베딩할 파일 경로를 제공해주세요. 예: ['new_accidents.json', 'new_education.json']"
        });
      }

      console.log(`추가 문서 임베딩 시작: ${filePaths.join(', ')}`);
      
      // 새로운 문서들을 기존 벡터DB에 추가
      const result = await chromaDBService.addNewDocuments(filePaths);
      
      // 추가 후 통계 정보 가져오기
      const stats = await chromaDBService.getStats();
      
      res.json({
        ...result,
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        }
      });
      
    } catch (error: any) {
      console.error('문서 추가 실패:', error);
      res.status(500).json({ 
        success: false,
        message: `문서 추가 실패: ${error.message}`,
        addedCount: 0
      });
    }
  });

  // ChromaDB 부분 재구성 엔드포인트  
  app.post("/api/rebuild-partial-vector-db", async (req, res) => {
    try {
      const { dataTypes } = req.body;
      
      if (!dataTypes || !Array.isArray(dataTypes)) {
        return res.status(400).json({ 
          message: "재구성할 데이터 타입을 지정해주세요 (incident, education, regulation)" 
        });
      }

      const validTypes = ['incident', 'education', 'regulation'];
      const filteredTypes = dataTypes.filter(type => validTypes.includes(type));
      
      if (filteredTypes.length === 0) {
        return res.status(400).json({ 
          message: "유효한 데이터 타입이 없습니다. (incident, education, regulation 중 선택)" 
        });
      }

      console.log(`부분 재구성 요청: ${filteredTypes.join(', ')}`);
      
      // 부분 재구성 실행
      await chromaDBService.rebuildPartialData(filteredTypes);
      
      // 재구성 후 통계 확인
      const stats = await chromaDBService.getStats();
      
      res.json({
        message: `${filteredTypes.join(', ')} 데이터 부분 재구성 완료`,
        rebuiltTypes: filteredTypes,
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        }
      });
    } catch (error: any) {
      console.error('부분 재구성 실패:', error);
      res.status(500).json({ 
        error: error.message,
        message: "부분 재구성 실패" 
      });
    }
  });

  // 단일 카테고리 부분 재구성 엔드포인트
  app.post("/api/partial-reconstruct", async (req, res) => {
    try {
      const { category } = req.body;
      
      if (!category || typeof category !== 'string') {
        return res.status(400).json({ 
          message: "재구성할 카테고리를 지정해주세요 (incident, education, regulation)" 
        });
      }

      const validCategories = ['incident', 'education', 'regulation'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          message: "유효한 카테고리가 아닙니다. (incident, education, regulation 중 선택)" 
        });
      }

      console.log(`부분 재구성 요청: ${category}`);
      
      // 부분 재구성 실행
      await chromaDBService.rebuildPartialData([category as "incident" | "education" | "regulation"]);
      
      // 재구성 후 통계 확인
      const stats = await chromaDBService.getStats();
      
      const categoryNames = {
        incident: '사고사례',
        education: '교육자료',
        regulation: '안전법규'
      };
      
      res.json({
        message: `${categoryNames[category as keyof typeof categoryNames]} 부분 재구성 완료`,
        category,
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        }
      });
    } catch (error: any) {
      const { category } = req.body;
      console.error(`${category} 부분 재구성 실패:`, error);
      res.status(500).json({ 
        error: error.message,
        message: `${category} 부분 재구성 실패` 
      });
    }
  });

  // /embed_data 폴더에서 벡터DB 재생성 엔드포인트
  app.post("/api/regenerate-vector-db", async (req, res) => {
    try {
      console.log('/embed_data 폴더에서 벡터DB 재생성 시작...');
      
      // ChromaDB 강제 재구축 (기존 데이터 삭제 후 새로 임베딩 생성)
      await chromaDBService.forceRebuildIndex();
      
      // 재생성 후 테스트 검색 수행
      const results = await chromaDBService.searchRelevantData(
        "산업안전 작업 안전수칙",
        10
      );
      
      // 통계 정보 가져오기
      const stats = await chromaDBService.getStats();
      
      res.json({
        message: "/embed_data 폴더에서 벡터DB 재생성 완료",
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        },
        searchResults: {
          found: results.length,
          results: results.map(r => ({
            type: r.metadata.type,
            title: r.metadata.title,
            source: r.metadata.source || 'json',
            distance: r.distance
          }))
        }
      });
    } catch (error: any) {
      console.error('벡터DB 재생성 실패:', error);
      res.status(500).json({ 
        error: error.message,
        message: "벡터DB 재생성 실패" 
      });
    }
  });

  // 체크포인트 상태 조회
  app.get('/api/embedding-status', async (req, res) => {
    try {
      const status = await (chromaDBService as any).getEmbeddingStatus();
      res.json(status);
    } catch (error: any) {
      console.error('임베딩 상태 조회 실패:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 백업에서 복구
  app.post('/api/restore-from-backup', async (req, res) => {
    try {
      const restored = await (chromaDBService as any).restoreFromBackup();
      if (restored) {
        res.json({ message: '백업에서 성공적으로 복구되었습니다.' });
      } else {
        res.status(404).json({ error: '백업 파일을 찾을 수 없습니다.' });
      }
    } catch (error: any) {
      console.error('백업 복구 실패:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 교육자료만 제거
  app.post('/api/remove-education-data', async (req, res) => {
    try {
      console.log('교육자료 제거 요청 받음...');
      
      const result = await chromaDBService.removeEducationData();
      
      res.json({
        message: '교육자료 제거 완료',
        removed: result.removed,
        remaining: result.remaining
      });
    } catch (error: any) {
      console.error('교육자료 제거 실패:', error);
      res.status(500).json({ 
        error: error.message,
        message: '교육자료 제거 실패' 
      });
    }
  });

  // 안전법규 데이터만 삭제
  app.post('/api/delete-regulations', async (req, res) => {
    try {
      console.log('=== 안전법규 데이터 삭제 요청 받음 ===');
      
      // 삭제 전 통계
      const beforeStats = await chromaDBService.getStats();
      console.log(`삭제 전 전체 문서 수: ${beforeStats.count}`);
      
      // 안전법규 삭제 실행
      console.log('deleteRegulations() 호출 시작...');
      await chromaDBService.deleteRegulations();
      console.log('deleteRegulations() 호출 완료');
      
      // 삭제 후 통계 확인
      const afterStats = await chromaDBService.getStats();
      console.log(`삭제 후 전체 문서 수: ${afterStats.count}`);
      
      res.json({
        message: '안전법규 데이터 삭제 완료',
        before: beforeStats.count,
        after: afterStats.count,
        deleted: beforeStats.count - afterStats.count,
        stats: {
          totalDocuments: afterStats.count,
          collections: afterStats.collections
        }
      });
    } catch (error: any) {
      console.error('안전법규 삭제 실패:', error);
      res.status(500).json({ 
        error: error.message,
        stack: error.stack,
        message: '안전법규 삭제 실패' 
      });
    }
  });

  // safety_rules.json 임베딩 (AI 브리핑 최적화)
  app.post('/api/embed-safety-rules', async (req, res) => {
    try {
      console.log('=== safety_rules.json 임베딩 시작 ===');
      
      // safety_rules.json 파일 임베딩
      const result = await chromaDBService.embedSafetyRulesFile();
      
      // 임베딩 후 통계 확인
      const stats = await chromaDBService.getStats();
      
      res.json({
        message: 'safety_rules.json 임베딩 완료',
        articlesProcessed: result.articlesProcessed,
        totalArticles: result.totalArticles,
        documentInfo: result.documentInfo,
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        }
      });
    } catch (error: any) {
      console.error('safety_rules.json 임베딩 실패:', error);
      res.status(500).json({ 
        error: error.message,
        stack: error.stack,
        message: 'safety_rules.json 임베딩 실패' 
      });
    }
  });

  // 특정 타입 문서 삭제 (범용)
  app.post('/api/delete-documents-by-type', async (req, res) => {
    try {
      const { type } = req.body;
      
      if (!type || typeof type !== 'string') {
        return res.status(400).json({ 
          message: "삭제할 문서 타입을 지정해주세요 (incident, education, regulation)" 
        });
      }

      const validTypes = ['incident', 'education', 'regulation'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ 
          message: "유효한 문서 타입이 아닙니다. (incident, education, regulation 중 선택)" 
        });
      }

      console.log(`${type} 타입 문서 삭제 요청 받음...`);
      
      await chromaDBService.deleteDocumentsByType(type);
      
      // 삭제 후 통계 확인
      const stats = await chromaDBService.getStats();
      
      const typeNames = {
        incident: '사고사례',
        education: '교육자료',
        regulation: '안전법규'
      };
      
      res.json({
        message: `${typeNames[type as keyof typeof typeNames]} 삭제 완료`,
        type,
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        }
      });
    } catch (error: any) {
      const { type } = req.body;
      console.error(`${type} 타입 문서 삭제 실패:`, error);
      res.status(500).json({ 
        error: error.message,
        message: `${type} 타입 문서 삭제 실패` 
      });
    }
  });

  // 체크포인트에서 재개
  app.post('/api/resume-embedding', async (req, res) => {
    try {
      const resumed = await (chromaDBService as any).resumeFromCheckpoint();
      if (resumed) {
        res.json({ message: '체크포인트에서 임베딩을 재개합니다.' });
      } else {
        res.status(404).json({ error: '체크포인트를 찾을 수 없습니다.' });
      }
    } catch (error: any) {
      console.error('체크포인트 재개 실패:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 누락된 데이터 이어서 임베딩
  app.post('/api/resume-incomplete-embedding', async (req, res) => {
    try {
      console.log('누락된 데이터 이어서 임베딩 요청받음');
      await (chromaDBService as any).resumeIncompleteEmbedding();
      res.json({ message: '누락된 데이터 임베딩 완료' });
    } catch (error: any) {
      console.error('부분 임베딩 실패:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 파일 업로드 및 임베딩 API
  app.post("/api/upload-and-embed", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: "파일이 업로드되지 않았습니다." 
        });
      }

      const file = req.file;
      const originalName = file.originalname;
      const ext = path.extname(originalName).toLowerCase();

      console.log(`파일 업로드됨: ${originalName} (${file.size} bytes)`);

      // 파일 내용 읽기
      const fileContent = await fs.readFile(file.path, 'utf-8');
      
      let documentsToAdd: any[] = [];
      
      if (ext === '.json') {
        try {
          const jsonData = JSON.parse(fileContent);
          documentsToAdd = Array.isArray(jsonData) ? jsonData : [jsonData];
        } catch (parseError) {
          await fs.unlink(file.path);
          return res.status(400).json({
            success: false,
            error: "JSON 파일 형식이 올바르지 않습니다."
          });
        }
      } else if (ext === '.txt') {
        documentsToAdd = [{
          title: originalName.replace(ext, ''),
          content: fileContent,
          type: 'education',
          source: 'uploaded'
        }];
      } else if (ext === '.pdf') {
        await fs.unlink(file.path);
        return res.status(400).json({
          success: false,
          error: "PDF 파일 처리는 현재 지원되지 않습니다."
        });
      }

      // ChromaDB에 문서 추가
      await chromaDBService.initialize();
      
      let addedCount = 0;
      for (let i = 0; i < documentsToAdd.length; i++) {
        const doc = documentsToAdd[i];
        const docType = doc.type || (doc.risk_keywords ? 'incident' : 'education');
        const content = docType === 'incident' 
          ? `${doc.title}\n${doc.summary || doc.content}\n위험요소: ${doc.risk_keywords || ''}\n예방대책: ${doc.prevention || ''}`
          : `${doc.title}\n${doc.content}`;
        
        const embedding = await (chromaDBService as any).generateEmbedding(content);
        await (chromaDBService as any).index.upsertItem({
          id: `uploaded_${Date.now()}_${i}`,
          vector: embedding,
          metadata: {
            type: docType,
            title: doc.title,
            source: 'uploaded',
            originalFile: originalName,
            content: content,
            ...doc
          }
        });
        
        addedCount++;
      }

      // 임시 파일 삭제
      await fs.unlink(file.path);

      // 통계 정보 가져오기
      const stats = await chromaDBService.getStats();

      res.json({
        success: true,
        message: `${addedCount}개 문서가 성공적으로 임베딩되었습니다.`,
        addedCount,
        originalFileName: originalName,
        stats: {
          totalDocuments: stats.count,
          collections: stats.collections
        }
      });

    } catch (error: any) {
      console.error('파일 업로드 및 임베딩 실패:', error);
      
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('임시 파일 삭제 실패:', unlinkError);
        }
      }
      
      res.status(500).json({
        success: false,
        error: `파일 처리 실패: ${error.message}`
      });
    }
  });

  // 안전한 벡터DB 재구축 (체크포인트 지원)
  app.post('/api/rebuild-vector-db', async (req, res) => {
    try {
      const { forceRebuild } = req.body;
      console.log('안전한 벡터DB 재구축 요청받음, forceRebuild:', forceRebuild);
      
      // 새로운 rebuildVectorDB 메서드 호출
      await (chromaDBService as any).rebuildVectorDB(forceRebuild);
      res.json({ message: '벡터DB 재구축 완료' });
    } catch (error: any) {
      console.error('벡터DB 재구축 실패:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
