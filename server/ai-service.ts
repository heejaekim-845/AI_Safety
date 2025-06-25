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
      const prompt = `다음 산업 설비에 대한 포괄적인 음성 안내 스크립트를 한국어로 작성해주세요. 
실제 작업 현장에서 작업자가 들을 수 있도록 체계적이고 상세하게 작성하세요.

설비 기본 정보:
- 설비명: ${equipmentInfo.name}
- 설비 코드: ${equipmentInfo.code}
- 위치: ${equipmentInfo.location}
- 제조사: ${equipmentInfo.manufacturer || '정보 없음'}
- 모델명: ${equipmentInfo.modelName || '정보 없음'}
- 설치년도: ${equipmentInfo.installationYear || '정보 없음'}
- 주요 사양: ${this.formatEquipmentSpecifications(equipmentInfo)}

유해화학물질 정보:
- 화학물질 유형: ${equipmentInfo.hazardousChemicalType || '해당 없음'}
- 화학물질명: ${equipmentInfo.hazardousChemicalName || '해당 없음'}
- 위험관리구역: ${equipmentInfo.riskManagementZone || '해당 없음'}

위험성 평가:
- 주요 위험 요소: ${this.formatRisks(equipmentInfo)}
- 고온 위험: ${equipmentInfo.highTemperatureRisk ? '있음 (150°C 이상)' : '없음'}
- 고압 위험: ${equipmentInfo.highPressureRisk ? '있음 (15 bar)' : '없음'}
- 전기적 위험: ${equipmentInfo.electricalRisk ? '있음' : '없음'}
- 회전체 위험: ${equipmentInfo.rotatingPartsRisk ? '있음' : '없음'}

안전 장비 및 절차:
- 필요 안전장비: ${equipmentInfo.requiredSafetyEquipment?.join(", ") || "기본 안전장비"}
- LOTO 포인트: ${equipmentInfo.lockoutTagoutPoints?.join(", ") || "해당 없음"}

비상 연락처: ${equipmentInfo.emergencyContact || '관제실'}

다음 구조로 5-6분 분량의 상세한 안내 멘트를 작성해주세요:
1. 설비 소개 및 기본 정보
2. 유해화학물질 관련 주의사항 (해당 시)
3. 주요 위험요소별 안전수칙
4. 필수 안전장비 착용 안내
5. 작업 전 점검사항
6. 비상상황 대응절차`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "당신은 산업 안전 음성 안내 전문가입니다. 실제 작업 현장에서 작업자의 안전을 보장하기 위한 체계적이고 포괄적인 음성 안내를 제공합니다. 전문적이면서도 이해하기 쉽게 설명하세요."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1500
      });

      return response.choices[0].message.content || "안전 수칙을 준수하여 작업하시기 바랍니다.";
    } catch (error) {
      console.error("AI 음성 안내 생성 오류:", error);
      
      // Safety-focused fallback guidance without basic equipment info
      return `${equipmentInfo.name} 안전 작업 안내

안전한 작업을 위한 주요 사항을 안내드립니다.

유해화학물질 정보를 확인하세요.
${equipmentInfo.hazardousChemicalType ? 
  `화학물질 유형: ${equipmentInfo.hazardousChemicalType}, 화학물질명: ${equipmentInfo.hazardousChemicalName || '정보 없음'}
  위험관리구역: ${equipmentInfo.riskManagementZone || '일반관리구역'}
  유해화학물질 취급 시 반드시 전용 보호장비를 착용하고 안전수칙을 준수하세요.` :
  '이 설비는 유해화학물질을 사용하지 않습니다.'
}

주요 위험요소를 안내드립니다.
${this.formatRisks(equipmentInfo)}
${equipmentInfo.highTemperatureRisk ? '고온 위험이 있으니 내열 장갑을 착용하세요. ' : ''}
${equipmentInfo.highPressureRisk ? '고압 가스 위험이 있으니 압력 해제 후 작업하세요. ' : ''}
${equipmentInfo.electricalRisk ? '전기적 위험이 있으니 전원 차단 후 작업하세요. ' : ''}
${equipmentInfo.rotatingPartsRisk ? '회전체 위험이 있으니 느슨한 옷이나 장신구를 제거하세요. ' : ''}

필수 안전장비를 착용하세요.
${equipmentInfo.requiredSafetyEquipment?.join(", ") || "안전모, 안전화, 보안경, 작업복"}

작업 전 반드시 안전점검을 실시하고, LOTO 절차를 준수하세요.
${equipmentInfo.lockoutTagoutPoints?.length ? `LOTO 포인트: ${equipmentInfo.lockoutTagoutPoints.join(", ")}` : ''}

비상상황 발생 시 즉시 ${equipmentInfo.emergencyContact || '관제실'}로 연락하여 주시기 바랍니다.

안전한 작업을 위해 모든 안전수칙을 준수해 주세요.`;
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

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "당신은 산업 안전 전문가입니다. 작업자의 특이사항을 분석하여 적절한 안전 조치사항을 JSON 형식으로 제공합니다."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
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
}

export const aiService = new AIService();
