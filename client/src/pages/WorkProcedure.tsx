import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProcedures } from "@/hooks/useProcedures";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Reply,
  ChevronRight
} from "lucide-react";
import type { WorkSession, WorkProcedure } from "@shared/schema";

// Function to get category color and styling
const getCategoryStyle = (category: string) => {
  const categoryLower = category?.toLowerCase() || "";
  
  if (categoryLower.includes("기기조작") || categoryLower.includes("조작") || categoryLower.includes("operation")) {
    return {
      badgeClass: "bg-green-100 text-green-800 border-green-200",
      cardClass: "border-l-4 border-l-green-500",
      dotClass: "bg-green-500"
    };
  } else if (categoryLower.includes("상태인지") || categoryLower.includes("확인") || categoryLower.includes("점검") || categoryLower.includes("check")) {
    return {
      badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
      cardClass: "border-l-4 border-l-yellow-500",
      dotClass: "bg-yellow-500"
    };
  } else if (categoryLower.includes("안전조치") || categoryLower.includes("안전") || categoryLower.includes("safety")) {
    return {
      badgeClass: "bg-red-100 text-red-800 border-red-200",
      cardClass: "border-l-4 border-l-red-500",
      dotClass: "bg-red-500"
    };
  }
  
  // Default styling
  return {
    badgeClass: "bg-gray-100 text-gray-800 border-gray-200",
    cardClass: "border-l-4 border-l-gray-300",
    dotClass: "bg-gray-400"
  };
};

export default function WorkProcedureComponent() {
  const { sessionId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [specialNotes, setSpecialNotes] = useState("");
  const [showRiskDialog, setShowRiskDialog] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [currentStepForAnalysis, setCurrentStepForAnalysis] = useState<any>(null);
  const [riskReport, setRiskReport] = useState({
    description: "",
    severity: "MEDIUM" as "HIGH" | "MEDIUM" | "LOW",
    reportedBy: ""
  });
  
  const sessionIdNum = parseInt(sessionId || "0");
  
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: [`/api/work-sessions/${sessionIdNum}`],
    enabled: !!sessionIdNum
  });
  
  const { data: procedures, isLoading: proceduresLoading } = useProcedures(
    session?.workTypeId || 0,
    !!session?.workTypeId
  );

  const updateSessionMutation = useMutation({
    mutationFn: async (data: Partial<WorkSession>) => {
      const response = await apiRequest("PUT", `/api/work-sessions/${sessionIdNum}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/work-sessions/${sessionIdNum}`] });
    }
  });

  const createRiskReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/risk-reports", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "위험 보고 완료",
        description: "위험 정보가 등록되었습니다.",
      });
      setShowRiskDialog(false);
      setRiskReport({ description: "", severity: "MEDIUM", reportedBy: "" });
    }
  });

  const analyzeStepNoteMutation = useMutation({
    mutationFn: async (data: { stepNote: string; stepInfo: any; equipmentId: number; workTypeId: number }) => {
      const response = await apiRequest("POST", "/api/ai/analyze-step-note", data);
      return response.json();
    },
    onSuccess: (result) => {
      setAiAnalysisResult(result);
      setShowAiAnalysis(true);
    },
    onError: (error) => {
      console.error("특이사항 분석 오류:", error);
      toast({
        title: "분석 오류",
        description: "특이사항 분석 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  });

  const handleStepComplete = (stepNumber: number) => {
    if (!session) return;
    
    const newCompletedSteps = [...(session.completedSteps || []), stepNumber];
    const newCurrentStep = stepNumber + 1;
    
    const updateData: Partial<WorkSession> = {
      completedSteps: newCompletedSteps,
      currentStep: newCurrentStep,
      ...(specialNotes && {
        specialNotes: [
          ...(session.specialNotes || []),
          { stepId: stepNumber, note: specialNotes }
        ]
      })
    };

    updateSessionMutation.mutate(updateData);
    setSpecialNotes("");
  };

  const handleAnalyzeStepNote = (step: WorkProcedure) => {
    if (!specialNotes.trim() || !session) return;
    
    setCurrentStepForAnalysis(step);
    analyzeStepNoteMutation.mutate({
      stepNote: specialNotes,
      stepInfo: {
        title: step.title,
        description: step.description,
        category: step.category
      },
      equipmentId: session.equipmentId,
      workTypeId: session.workTypeId
    });
  };

  const handleRiskReport = () => {
    if (!session || !riskReport.description || !riskReport.reportedBy) {
      toast({
        title: "입력 오류",
        description: "모든 필드를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    createRiskReportMutation.mutate({
      equipmentId: session.equipmentId,
      workSessionId: session.id,
      riskDescription: riskReport.description,
      severity: riskReport.severity,
      reportedBy: riskReport.reportedBy
    });
  };

  if (sessionLoading || proceduresLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">작업 절차를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!session || !procedures) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">작업 세션을 찾을 수 없습니다.</p>
        <Button onClick={() => setLocation("/")} className="mt-4">
          처음으로 돌아가기
        </Button>
      </div>
    );
  }

  const currentStep = session.currentStep || 1;
  const completedSteps = session.completedSteps || [];
  const totalSteps = procedures.length;
  const progress = (completedSteps.length / totalSteps) * 100;
  
  const currentProcedure = procedures.find(p => p.stepNumber === currentStep);
  const completedProcedures = procedures.filter(p => completedSteps.includes(p.stepNumber));
  const upcomingProcedures = procedures.filter(p => p.stepNumber > currentStep);

  return (
    <div className="p-4 pb-24 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/equipment/${session.equipmentId}/work-types`)}
            className="text-gray-600 hover:bg-gray-100 p-1 mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-medium">작업 절차</h2>
        </div>
        <span className="text-sm text-gray-600">
          {completedSteps.length}/{totalSteps} 완료
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <Progress value={progress} className="h-2" />
      </div>

      {/* Current Step */}
      {currentProcedure && (() => {
        const categoryStyle = getCategoryStyle(currentProcedure.category);
        return (
          <Card className={`card-minimal bg-primary/5 border-primary/20 mb-4 ${categoryStyle.cardClass}`}>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className={`${categoryStyle.dotClass} text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium`}>
                  {currentProcedure.stepNumber}
                </div>
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h3 className="font-medium text-primary mr-2">{currentProcedure.title}</h3>
                    <Badge variant="outline" className={`text-xs ${categoryStyle.badgeClass}`}>
                      {currentProcedure.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-primary/80 mb-4">{currentProcedure.description}</p>
                
                  {/* Step Checklist */}
                  {currentProcedure.checklistItems && currentProcedure.checklistItems.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {currentProcedure.checklistItems.map((item, index) => (
                        <label key={index} className="flex items-start space-x-3">
                          <Checkbox className="mt-1" />
                          <span className="text-sm">{item}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Safety Notes */}
                  {currentProcedure.safetyNotes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <p className="text-sm text-yellow-800">{currentProcedure.safetyNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* Special Notes Input */}
                  <div className="mt-4">
                    <Label className="text-sm font-medium text-gray-700 mb-2">특이사항 입력</Label>
                    <Textarea
                      value={specialNotes}
                      onChange={(e) => setSpecialNotes(e.target.value)}
                      placeholder="이상 상황이나 주의사항을 입력하세요..."
                      rows={3}
                      className="w-full mb-3"
                    />
                    
                    <div className="flex gap-2">
                      {specialNotes.trim() && (
                        <Button 
                          variant="outline"
                          onClick={() => handleAnalyzeStepNote(currentProcedure)}
                          disabled={analyzeStepNoteMutation.isPending}
                          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                        >
                          {analyzeStepNoteMutation.isPending ? "분석 중..." : "AI 안전 분석"}
                        </Button>
                      )}
                      <Button
                        onClick={() => handleStepComplete(currentProcedure.stepNumber)}
                        disabled={updateSessionMutation.isPending}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        {currentProcedure.stepNumber === totalSteps ? "작업 완료" : "다음 단계"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Completed Steps */}
      {completedProcedures.length > 0 && (
        <div className="space-y-3 mb-4">
          <h3 className="font-medium text-gray-900">완료된 단계</h3>
          {completedProcedures.map((procedure) => {
            const categoryStyle = getCategoryStyle(procedure.category);
            return (
              <Card key={procedure.id} className={`bg-green-50 border-green-200 ${categoryStyle.cardClass}`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`${categoryStyle.dotClass} text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium`}>
                      {procedure.stepNumber}
                    </div>
                    <div>
                      <span className="text-sm text-success font-medium">{procedure.title}</span>
                      <Badge variant="outline" className={`text-xs mt-1 ml-2 ${categoryStyle.badgeClass}`}>
                        {procedure.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upcoming Steps */}
      {upcomingProcedures.length > 0 && (
        <div className="space-y-3 mb-4">
          <h3 className="font-medium text-gray-900">다음 단계</h3>
          {upcomingProcedures.slice(0, 3).map((procedure) => {
            const categoryStyle = getCategoryStyle(procedure.category);
            return (
              <Card key={procedure.id} className={`bg-gray-50 border-gray-200 ${categoryStyle.cardClass}`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`${categoryStyle.dotClass} text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium`}>
                      {procedure.stepNumber}
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{procedure.title}</span>
                      <Badge variant="outline" className={`text-xs mt-1 ml-2 ${categoryStyle.badgeClass}`}>
                        {procedure.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={() => setShowRiskDialog(true)}
          variant="outline"
          className="w-full border-warning text-warning hover:bg-warning hover:text-white"
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          위험 정보 등록
        </Button>
        
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            toast({
              title: "전문가 연락",
              description: "안전관리자에게 연락하시기 바랍니다.",
            });
          }}
        >
          <Reply className="mr-2 h-4 w-4" />
          전문가 연락
        </Button>
      </div>

      {/* Risk Report Dialog */}
      <Dialog open={showRiskDialog} onOpenChange={setShowRiskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>위험 정보 등록</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>보고자명</Label>
              <Input
                value={riskReport.reportedBy}
                onChange={(e) => setRiskReport(prev => ({ ...prev, reportedBy: e.target.value }))}
                placeholder="이름을 입력하세요"
              />
            </div>

            <div>
              <Label>위험 수준</Label>
              <select
                value={riskReport.severity}
                onChange={(e) => setRiskReport(prev => ({ ...prev, severity: e.target.value as any }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="LOW">낮음</option>
                <option value="MEDIUM">보통</option>
                <option value="HIGH">높음</option>
              </select>
            </div>

            <div>
              <Label>위험 상황 설명</Label>
              <Textarea
                value={riskReport.description}
                onChange={(e) => setRiskReport(prev => ({ ...prev, description: e.target.value }))}
                placeholder="발견된 위험 상황을 상세히 설명해주세요"
                rows={4}
              />
            </div>

            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setShowRiskDialog(false)}
              >
                취소
              </Button>
              <Button 
                className="flex-1 bg-warning hover:bg-warning/90" 
                onClick={handleRiskReport}
                disabled={createRiskReportMutation.isPending}
              >
                {createRiskReportMutation.isPending ? "등록 중..." : "등록"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Results Dialog */}
      <Dialog open={showAiAnalysis} onOpenChange={setShowAiAnalysis}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              AI 안전 분석 결과
              {aiAnalysisResult && (
                <Badge 
                  variant={aiAnalysisResult.riskLevel === "HIGH" ? "destructive" : 
                           aiAnalysisResult.riskLevel === "MEDIUM" ? "default" : "secondary"}
                  className={
                    aiAnalysisResult.riskLevel === "HIGH" ? "bg-red-100 text-red-800" :
                    aiAnalysisResult.riskLevel === "MEDIUM" ? "bg-yellow-100 text-yellow-800" : 
                    "bg-green-100 text-green-800"
                  }
                >
                  {aiAnalysisResult.riskLevel === "HIGH" ? "고위험" : 
                   aiAnalysisResult.riskLevel === "MEDIUM" ? "중위험" : "저위험"}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {aiAnalysisResult && (
            <div className="space-y-6">
              {/* Analysis Context */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">분석 대상</h4>
                <p className="text-sm text-blue-800 mb-1">
                  <strong>작업 단계:</strong> {currentStepForAnalysis?.title}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>특이사항:</strong> "{specialNotes}"
                </p>
              </div>

              {/* Safety Recommendations */}
              {aiAnalysisResult.recommendations?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    안전 권고사항
                  </h4>
                  <ul className="space-y-2">
                    {aiAnalysisResult.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Immediate Actions */}
              {aiAnalysisResult.immediateActions?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    즉시 조치사항
                  </h4>
                  <ul className="space-y-2">
                    {aiAnalysisResult.immediateActions.map((action: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-sm bg-red-50 border border-red-200 rounded p-2">
                        <ChevronRight className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span className="text-red-800">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preventive Measures */}
              {aiAnalysisResult.preventiveMeasures?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    예방 조치사항
                  </h4>
                  <ul className="space-y-2">
                    {aiAnalysisResult.preventiveMeasures.map((measure: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{measure}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowAiAnalysis(false)}
                >
                  확인
                </Button>
                {aiAnalysisResult.riskLevel === "HIGH" && (
                  <Button 
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white" 
                    onClick={() => {
                      setShowAiAnalysis(false);
                      setShowRiskDialog(true);
                      setRiskReport(prev => ({
                        ...prev,
                        description: `AI 분석 결과 고위험 상황 감지: ${specialNotes}`,
                        severity: "HIGH"
                      }));
                    }}
                  >
                    위험 보고 등록
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
