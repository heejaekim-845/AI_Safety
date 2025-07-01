import { GoogleGenAI } from "@google/genai";

// Using Google Gemini for AI-powered safety analysis
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 산업 안전 전문가입니다. 설비 안전 분석을 수행하고 실용적인 안전 권장사항을 제공합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              riskLevel: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              recommendations: { type: "array", items: { type: "string" } },
              procedureAdjustments: { type: "array", items: { type: "string" } },
              emergencyProcedures: { type: "array", items: { type: "string" } }
            },
            required: ["riskLevel", "recommendations", "procedureAdjustments", "emergencyProcedures"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
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

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 산업 안전 전문가입니다. 위험 보고서를 분석하고 실용적인 대응 방안을 제공합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              recommendations: { type: "array", items: { type: "string" } },
              immediateActions: { type: "array", items: { type: "string" } },
              preventiveMeasures: { type: "array", items: { type: "string" } }
            },
            required: ["severity", "recommendations", "immediateActions", "preventiveMeasures"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
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
      const prompt = `다음 산업 설비에 대한 간결한 안전 음성 안내를 한국어로 작성해주세요. 
30초 이내로 읽을 수 있도록 핵심 안전사항만 포함하세요.

설비명: ${equipmentInfo.name}
위치: ${equipmentInfo.location}

주요 위험 요소:
${this.formatRisks(equipmentInfo)}

유해화학물질: ${equipmentInfo.hazardousChemicalType || '해당 없음'}

필수 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "기본 안전장비"}

다음 순서로 30초 이내 간결한 안내 멘트를 작성하세요:
1. 설비명과 위치 (5초)
2. 핵심 위험요소와 주의사항 (15초)
3. 필수 안전장비 및 비상연락처 (10초)

간결하고 명확하게 작성하여 작업자가 빠르게 이해할 수 있도록 해주세요.`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 산업 안전 음성 안내 전문가입니다. 30초 이내로 읽을 수 있는 간결하고 핵심적인 안전 안내를 제공합니다. 불필요한 설명은 생략하고 꼭 필요한 안전 정보만 포함하세요."
        },
        contents: prompt
      });

      return response.text || "안전 수칙을 준수하여 작업하시기 바랍니다.";
    } catch (error) {
      console.error("AI 음성 안내 생성 오류:", error);
      
      // 간결한 안전 중심 폴백 안내
      const riskMessages = [];
      if (equipmentInfo.highTemperature) riskMessages.push("고온 위험");
      if (equipmentInfo.highPressure) riskMessages.push("고압 위험");
      if (equipmentInfo.highVoltage) riskMessages.push("전기 위험");
      if (equipmentInfo.height) riskMessages.push("추락 위험");
      if (equipmentInfo.mechanical) riskMessages.push("기계적 위험");

      return `${equipmentInfo.name} 안전 안내

${equipmentInfo.location}에 위치한 ${equipmentInfo.name}입니다.

${riskMessages.length > 0 ? `주요 위험: ${riskMessages.join(", ")}이 있습니다.` : '일반적인 안전수칙을 준수하세요.'}

${equipmentInfo.hazardousChemicalType ? `${equipmentInfo.hazardousChemicalType} 화학물질 주의. ` : ''}필수 안전장비를 착용하고 작업하세요.

비상시 관제실에 즉시 연락하시기 바랍니다.`;
    }
  }

  async analyzeStepNote(stepNote: string, stepInfo: any, equipmentInfo: any): Promise<{
    recommendations: string[];
    riskLevel: "HIGH" | "MEDIUM" | "LOW";
    immediateActions: string[];
    preventiveMeasures: string[];
  }> {
    try {
      const equipmentRisks = this.formatRisks(equipmentInfo);
      const equipmentSpecs = this.formatEquipmentSpecifications(equipmentInfo);
      
      const prompt = `산업 안전 전문가로서 작업자가 입력한 특이사항을 종합적으로 분석하여 맞춤형 안전 조치사항을 제공해주세요.

【설비 정보】
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 위험도: ${equipmentInfo.riskLevel}
- 주요 위험 요소: ${equipmentRisks}
- 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "없음"}
- LOTO 포인트: ${equipmentInfo.lockoutTagoutPoints?.join(", ") || "없음"}

【작업 정보】
- 작업: ${stepInfo.title}
- 내용: ${stepInfo.description}
- 유형: ${stepInfo.workType || stepInfo.category || "일반"}

【작업자 특이사항】
"${stepNote}"

위 특이사항을 바탕으로 다음을 분석해주세요:
1. 이 특이사항이 설비와 작업에 미치는 구체적인 위험도
2. 특이사항에 직접 대응하는 맞춤형 안전 조치
3. 현재 상황에서 즉시 취해야 할 구체적 행동
4. 이런 상황이 재발하지 않도록 하는 예방책

JSON 형식으로 응답:
{
  "riskLevel": "HIGH|MEDIUM|LOW",
  "recommendations": ["특이사항에 직접 대응하는 구체적 안전 조치 3-4개"],
  "immediateActions": ["지금 당장 해야 할 구체적 행동 2-3개"],
  "preventiveMeasures": ["재발 방지를 위한 구체적 예방책 2-3개"]
}

중요: 일반적인 조언이 아닌, 입력된 특이사항("${stepNote}")에 직접 관련된 구체적이고 실용적인 조치사항만 제공하세요.`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 산업 안전 전문가입니다. 작업자의 특이사항을 분석하여 적절한 안전 조치사항을 JSON 형식으로 제공합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              riskLevel: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              recommendations: { type: "array", items: { type: "string" } },
              immediateActions: { type: "array", items: { type: "string" } },
              preventiveMeasures: { type: "array", items: { type: "string" } }
            },
            required: ["riskLevel", "recommendations", "immediateActions", "preventiveMeasures"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
      return {
        riskLevel: result.riskLevel || "MEDIUM",
        recommendations: result.recommendations || [],
        immediateActions: result.immediateActions || [],
        preventiveMeasures: result.preventiveMeasures || []
      };
    } catch (error) {
      console.error("작업 특이사항 분석 오류:", error);
      
      // Enhanced contextual fallback analysis
      const noteText = stepNote.toLowerCase();
      const equipmentType = equipmentInfo.name?.toLowerCase() || "";
      
      // Analyze specific issues mentioned in the note
      const hasLeakage = noteText.includes('누수') || noteText.includes('누출') || noteText.includes('새고');
      const hasNoise = noteText.includes('소음') || noteText.includes('잡음') || noteText.includes('시끄러');
      const hasVibration = noteText.includes('진동') || noteText.includes('떨림');
      const hasOverheating = noteText.includes('과열') || noteText.includes('뜨거') || noteText.includes('온도');
      const hasElectricalIssue = noteText.includes('스파크') || noteText.includes('전기') || noteText.includes('합선');
      const hasSmell = noteText.includes('냄새') || noteText.includes('가스') || noteText.includes('연기');
      const hasDamage = noteText.includes('손상') || noteText.includes('파손') || noteText.includes('금') || noteText.includes('균열');
      const hasLoose = noteText.includes('헐거') || noteText.includes('느슨') || noteText.includes('흔들');
      
      // Determine risk level based on specific issues
      let riskLevel: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
      if (hasElectricalIssue || hasSmell || hasDamage || hasLeakage) {
        riskLevel = "HIGH";
      } else if (hasOverheating || hasVibration || hasLoose) {
        riskLevel = "HIGH";
      } else if (hasNoise) {
        riskLevel = "MEDIUM";
      }
      
      // Generate contextual recommendations
      let recommendations: string[] = [];
      let immediateActions: string[] = [];
      let preventiveMeasures: string[] = [];
      
      if (hasLeakage) {
        recommendations.push("누수 지점을 확인하고 주변을 격리하세요");
        recommendations.push("유체 종류에 맞는 개인보호구를 착용하세요");
        immediateActions.push("누수 부위 주변 작업 중단");
        immediateActions.push("누수량과 확산 범위 확인");
        preventiveMeasures.push("정기적인 배관 및 연결부 점검");
        preventiveMeasures.push("개스킷 및 씰 교체 주기 단축");
      }
      
      if (hasNoise) {
        recommendations.push("소음 발생 원인을 파악하고 베어링 상태를 점검하세요");
        recommendations.push("청력 보호구를 반드시 착용하세요");
        immediateActions.push("소음 레벨 측정");
        immediateActions.push("작업자 청력 보호구 확인");
        preventiveMeasures.push("정기적인 소음도 측정 및 기록");
        preventiveMeasures.push("회전부품 윤활 및 정렬 점검 강화");
      }
      
      if (hasVibration) {
        recommendations.push("진동 원인을 찾아 기계 정렬 상태를 점검하세요");
        recommendations.push("볼트 및 고정부 체결 상태를 확인하세요");
        immediateActions.push("진동 수준 측정");
        immediateActions.push("주변 구조물 안전성 확인");
        preventiveMeasures.push("정기적인 진동 분석 실시");
        preventiveMeasures.push("기계 기초 및 고정 상태 점검 강화");
      }
      
      if (hasOverheating) {
        recommendations.push("온도 상승 원인을 파악하고 냉각 시스템을 점검하세요");
        recommendations.push("내열 장갑과 보호복을 착용하세요");
        immediateActions.push("온도 측정 및 기록");
        immediateActions.push("냉각 시스템 작동 상태 확인");
        preventiveMeasures.push("정기적인 열화상 점검");
        preventiveMeasures.push("냉각 시스템 청소 및 정비 주기 단축");
      }
      
      if (hasElectricalIssue) {
        recommendations.push("즉시 전원을 차단하고 전기 안전 절차를 따르세요");
        recommendations.push("절연 보호구를 착용하고 접근하세요");
        immediateActions.push("즉시 전원 차단");
        immediateActions.push("전기 전문가 호출");
        preventiveMeasures.push("전기 시설 정기 절연 저항 측정");
        preventiveMeasures.push("전기 안전 교육 강화");
      }
      
      if (hasSmell) {
        recommendations.push("환기를 강화하고 가스 농도를 측정하세요");
        recommendations.push("호흡 보호구를 착용하고 점화원을 제거하세요");
        immediateActions.push("즉시 환기 실시");
        immediateActions.push("가스 검지기로 농도 측정");
        preventiveMeasures.push("정기적인 가스 누출 점검");
        preventiveMeasures.push("환기 시설 점검 및 개선");
      }
      
      if (hasDamage) {
        recommendations.push("손상 범위를 정확히 파악하고 구조적 안전성을 평가하세요");
        recommendations.push("손상 부위 접근을 제한하고 임시 보강을 검토하세요");
        immediateActions.push("손상 부위 사진 촬영 및 기록");
        immediateActions.push("구조 안전 전문가 상담");
        preventiveMeasures.push("정기적인 비파괴 검사 실시");
        preventiveMeasures.push("재료 피로도 평가 및 교체 계획 수립");
      }
      
      if (hasLoose) {
        recommendations.push("헐거운 부품의 체결 토크를 재확인하세요");
        recommendations.push("연결부 전체의 고정 상태를 점검하세요");
        immediateActions.push("즉시 체결 상태 점검");
        immediateActions.push("토크 렌치로 규정 토크 재체결");
        preventiveMeasures.push("정기적인 체결부 토크 점검");
        preventiveMeasures.push("진동에 의한 풀림 방지 대책 적용");
      }
      
      // Add general recommendations if no specific issue detected
      if (recommendations.length === 0) {
        recommendations.push("특이사항에 대해 상세한 점검을 실시하세요");
        recommendations.push("관련 작업 매뉴얼을 재확인하세요");
        immediateActions.push("현재 상황 상세 기록");
        immediateActions.push("상급자에게 상황 보고");
        preventiveMeasures.push("유사 상황 대응 절차 수립");
        preventiveMeasures.push("작업자 교육 및 훈련 강화");
      }
      
      return {
        riskLevel,
        recommendations: recommendations.slice(0, 4),
        immediateActions: immediateActions.slice(0, 3),
        preventiveMeasures: preventiveMeasures.slice(0, 3)
      };
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

  private formatEquipmentSpecifications(equipmentInfo: any): string {
    const specs = [];
    if (equipmentInfo.specification) {
      specs.push(`사양: ${equipmentInfo.specification}`);
    }
    if (equipmentInfo.installYear) {
      const age = new Date().getFullYear() - equipmentInfo.installYear;
      specs.push(`사용연수: ${age}년`);
    }
    if (equipmentInfo.manufacturer) {
      specs.push(`제조사: ${equipmentInfo.manufacturer}`);
    }
    return specs.length > 0 ? specs.join(" | ") : "상세 정보 없음";
  }
  async analyzeWorkTypeRisk(workTypeId: number, workTypeName: string, equipmentInfo: any): Promise<{
    workTypeName: string;
    riskFactors: Array<{
      factor: string;
      probability: number; // 1-5
      severity: number; // 1-4
      score: number; // probability × severity
      measures: string[];
    }>;
    totalScore: number;
    overallRiskLevel: "HIGH" | "MEDIUM" | "LOW";
    complianceNotes: string[];
  }> {
    try {
      const prompt = `${workTypeName} 작업에 대한 산업안전보건법 기준 위험성평가를 수행해주세요.

설비 정보:
- 설비명: ${equipmentInfo.name}
- 위치: ${equipmentInfo.location}
- 주요 위험요소: ${this.formatRisks(equipmentInfo)}
- 고온위험: ${equipmentInfo.highTemperatureRisk ? '있음' : '없음'}
- 고압위험: ${equipmentInfo.highPressureRisk ? '있음' : '없음'}
- 전기위험: ${equipmentInfo.electricalRisk ? '있음' : '없음'}
- 회전체위험: ${equipmentInfo.rotatingPartsRisk ? '있음' : '없음'}

작업 유형: ${workTypeName}

다음 기준으로 위험성평가를 수행하고 JSON 형태로 응답해주세요:

1. 위험요소별 평가:
   - 발생가능성 (1-5점): 1=거의없음, 2=희박, 3=가능, 4=자주발생, 5=항상발생
   - 심각도 (1-4점): 1=경미, 2=중간, 3=심각, 4=치명적
   - 위험점수 = 발생가능성 × 심각도 (최대 20점)

2. 위험요소는 최소 3개 이상 포함:
   - 물리적 위험 (고온, 고압, 전기, 회전체 등)
   - 화학적 위험 (해당시)
   - 인간공학적 위험 (작업자세, 반복작업 등)
   - 기타 작업 특성에 따른 위험

3. 각 위험요소별 구체적인 대응조치 3개 이상

4. 산업안전보건법 준수사항 포함

응답 형식:
{
  "workTypeName": "${workTypeName}",
  "riskFactors": [
    {
      "factor": "위험요소명",
      "probability": 발생가능성점수,
      "severity": 심각도점수,
      "score": 위험점수,
      "measures": ["대응조치1", "대응조치2", "대응조치3"]
    }
  ],
  "totalScore": 총점,
  "overallRiskLevel": "HIGH/MEDIUM/LOW",
  "complianceNotes": ["산업안전보건법 준수사항1", "준수사항2"]
}

전체 위험도 기준:
- HIGH: 총점 15점 이상
- MEDIUM: 총점 8-14점
- LOW: 총점 7점 이하`;

      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "당신은 한국의 산업안전보건법 전문가입니다. 정확한 위험성평가를 수행하고 법적 요구사항에 맞는 안전조치를 제시합니다.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              workTypeName: { type: "string" },
              riskFactors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    factor: { type: "string" },
                    probability: { type: "number", minimum: 1, maximum: 5 },
                    severity: { type: "number", minimum: 1, maximum: 4 },
                    score: { type: "number" },
                    measures: { type: "array", items: { type: "string" } }
                  },
                  required: ["factor", "probability", "severity", "score", "measures"]
                }
              },
              totalScore: { type: "number" },
              overallRiskLevel: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
              complianceNotes: { type: "array", items: { type: "string" } }
            },
            required: ["workTypeName", "riskFactors", "totalScore", "overallRiskLevel", "complianceNotes"]
          },
          temperature: 0.3
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
      // Calculate total score
      const totalScore = result.riskFactors?.reduce((sum: number, risk: any) => sum + risk.score, 0) || 0;
      
      // Determine overall risk level
      let overallRiskLevel = "LOW";
      if (totalScore >= 15) overallRiskLevel = "HIGH";
      else if (totalScore >= 8) overallRiskLevel = "MEDIUM";

      return {
        workTypeName: result.workTypeName || workTypeName,
        riskFactors: result.riskFactors || [],
        totalScore,
        overallRiskLevel: overallRiskLevel as "HIGH" | "MEDIUM" | "LOW",
        complianceNotes: result.complianceNotes || []
      };
    } catch (error) {
      console.error("AI 위험성평가 오류:", error);
      
      // Fallback risk assessment
      return {
        workTypeName,
        riskFactors: [
          {
            factor: "고압 가스 노출",
            probability: 3,
            severity: 4,
            score: 12,
            measures: [
              "작업 전 압력 완전 해제 확인",
              "개인보호구 착용 의무화",
              "안전작업절차서 숙지 및 준수"
            ]
          },
          {
            factor: "전기적 위험",
            probability: 2,
            severity: 4,
            score: 8,
            measures: [
              "전원 차단 후 작업 실시",
              "절연장갑 착용",
              "전기 안전 점검 실시"
            ]
          },
          {
            factor: "회전체 접촉",
            probability: 2,
            severity: 3,
            score: 6,
            measures: [
              "회전부 완전 정지 확인",
              "안전덮개 설치 확인",
              "느슨한 의복 착용 금지"
            ]
          }
        ],
        totalScore: 26,
        overallRiskLevel: "HIGH",
        complianceNotes: [
          "산업안전보건법 제38조에 따른 위험성평가 실시",
          "동법 제39조에 따른 안전보건조치 이행",
          "개인보호구 지급 및 착용 의무 (동법 제32조)",
          "안전작업절차서 작성 및 교육 실시 (동법 제31조)"
        ]
      };
    }
  }
}

export const aiService = new AIService();
