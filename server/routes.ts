import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { aiService } from "./ai-service";
import { z } from "zod";
import { 
  insertEquipmentSchema, 
  insertWorkTypeSchema, 
  insertWorkProcedureSchema,
  insertWorkSessionSchema,
  insertRiskReportSchema
} from "@shared/schema";

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

  app.put("/api/equipment/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const equipmentData = insertEquipmentSchema.partial().parse(req.body);
      const equipment = await storage.updateEquipment(id, equipmentData);
      res.json(equipment);
    } catch (error) {
      console.error("설비 업데이트 오류:", error);
      if (error instanceof z.ZodError) {
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

  app.post("/api/procedures", async (req, res) => {
    try {
      const procedureData = insertWorkProcedureSchema.parse(req.body);
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
        reportData.riskDescription,
        reportData.reportedBy
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

  const httpServer = createServer(app);
  return httpServer;
}
