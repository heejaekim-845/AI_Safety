import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface SafetyAnalysis {
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  recommendations: string[];
  procedureAdjustments: string[];
  emergencyProcedures: string[];
}

export interface RiskAnalysis {
  severity: "HIGH" | "MEDIUM" | "LOW";
  recommendations: string[];
  immediateActions: string[];
  preventiveMeasures: string[];
}

export class AIService {
  async analyzeSafetyConditions(
    equipmentInfo: any,
    workType: any,
    specialNotes: string
  ): Promise<SafetyAnalysis> {
    try {
      const prompt = `다음 산업 설비의 안전 상황을 분석하고 한국어로 응답해주세요.

설비 정보:
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 위험 요소: ${this.formatRisks(equipmentInfo)}
- 필요 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "없음"}

작업 정보:
- 작업 유형: ${workType.name}
- 설명: ${workType.description}
- 소요 시간: ${workType.estimatedDuration}분

특이사항: ${specialNotes || "없음"}

다음 형식으로 JSON 응답을 제공해주세요:
{
  "riskLevel": "HIGH|MEDIUM|LOW",
  "recommendations": ["권장사항1", "권장사항2", ...],
  "procedureAdjustments": ["절차조정1", "절차조정2", ...],
  "emergencyProcedures": ["비상절차1", "비상절차2", ...]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "당신은 산업 안전 전문가입니다. 설비 안전 분석을 수행하고 실용적인 안전 권장사항을 제공합니다."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        riskLevel: result.riskLevel || "MEDIUM",
        recommendations: result.recommendations || [],
        procedureAdjustments: result.procedureAdjustments || [],
        emergencyProcedures: result.emergencyProcedures || []
      };
    } catch (error) {
      console.error("AI 안전 분석 오류:", error);
      return {
        riskLevel: "MEDIUM",
        recommendations: ["AI 분석을 사용할 수 없습니다. 수동으로 안전 점검을 수행하세요."],
        procedureAdjustments: [],
        emergencyProcedures: ["비상시 안전관리자에게 즉시 연락하세요."]
      };
    }
  }

  async analyzeRiskReport(
    equipmentInfo: any,
    riskDescription: string,
    reportedBy: string
  ): Promise<RiskAnalysis> {
    try {
      const prompt = `다음 산업 설비의 위험 보고서를 분석하고 한국어로 응답해주세요.

설비 정보:
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 기존 위험 요소: ${this.formatRisks(equipmentInfo)}

위험 보고:
- 보고자: ${reportedBy}
- 위험 내용: ${riskDescription}

다음 형식으로 JSON 응답을 제공해주세요:
{
  "severity": "HIGH|MEDIUM|LOW",
  "recommendations": ["권장사항1", "권장사항2", ...],
  "immediateActions": ["즉시조치1", "즉시조치2", ...],
  "preventiveMeasures": ["예방조치1", "예방조치2", ...]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "당신은 산업 안전 전문가입니다. 위험 보고서를 분석하고 실용적인 대응 방안을 제공합니다."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        severity: result.severity || "MEDIUM",
        recommendations: result.recommendations || [],
        immediateActions: result.immediateActions || [],
        preventiveMeasures: result.preventiveMeasures || []
      };
    } catch (error) {
      console.error("AI 위험 분석 오류:", error);
      return {
        severity: "MEDIUM",
        recommendations: ["AI 분석을 사용할 수 없습니다. 안전관리자와 상담하세요."],
        immediateActions: ["즉시 작업을 중단하고 안전관리자에게 보고하세요."],
        preventiveMeasures: ["정기적인 설비 점검을 실시하세요."]
      };
    }
  }

  async generateVoiceGuide(equipmentInfo: any): Promise<string> {
    try {
      const prompt = `다음 산업 설비에 대한 음성 안내 스크립트를 한국어로 작성해주세요. 
작업자가 들을 수 있도록 명확하고 간결하게 작성하세요.

설비 정보:
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 주요 위험 요소: ${this.formatRisks(equipmentInfo)}
- 필요 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "없음"}

300자 이내로 핵심 안전 사항을 포함한 안내 멘트를 작성해주세요.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "당신은 산업 안전 음성 안내 전문가입니다. 작업자의 안전을 위한 명확하고 이해하기 쉬운 음성 안내를 제공합니다."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500
      });

      return response.choices[0].message.content || "안전 수칙을 준수하여 작업하시기 바랍니다.";
    } catch (error) {
      console.error("AI 음성 안내 생성 오류:", error);
      return `${equipmentInfo.name} 작업 시 안전 장비를 착용하고 주의사항을 준수하시기 바랍니다.`;
    }
  }

  private formatRisks(equipmentInfo: any): string {
    const risks = [];
    if (equipmentInfo.highVoltageRisk) risks.push("고전압");
    if (equipmentInfo.highPressureRisk) risks.push("고압가스");
    if (equipmentInfo.highTemperatureRisk) risks.push("고온");
    if (equipmentInfo.heightRisk) risks.push("고소");
    if (equipmentInfo.heavyWeightRisk) risks.push("고중량");
    return risks.length > 0 ? risks.join(", ") : "없음";
  }
}

export const aiService = new AIService();
