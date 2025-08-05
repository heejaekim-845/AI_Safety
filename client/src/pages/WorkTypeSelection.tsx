import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkTypes } from "@/hooks/useWorkTypes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import RiskLevelBadge from "@/components/RiskLevelBadge";
import { 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  AlertTriangleIcon,
  ChevronRight,
  X,
  BarChart3
} from "lucide-react";
import type { Incident, WorkType } from "@shared/schema";

interface RiskAssessment {
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
}

export default function WorkTypeSelection() {
  const { equipmentId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedWorkType, setSelectedWorkType] = useState<WorkType | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({});
  const [workerName, setWorkerName] = useState("");
  const [showRiskAssessment, setShowRiskAssessment] = useState(false);
  const [riskAssessmentData, setRiskAssessmentData] = useState<RiskAssessment | null>(null);
  const [analyzingWorkTypeId, setAnalyzingWorkTypeId] = useState<number | null>(null);
  
  const equipmentIdNum = parseInt(equipmentId || "0");
  
  const { data: workTypes, isLoading } = useWorkTypes(equipmentIdNum);
  
  const { data: incidents } = useQuery({
    queryKey: [`/api/work-types/${selectedWorkType?.id}/incidents`],
    enabled: !!selectedWorkType?.id
  });

  const riskAssessmentMutation = useMutation({
    mutationFn: async (workTypeId: number) => {
      const response = await apiRequest("POST", `/api/ai/risk-assessment/${workTypeId}`, {});
      return response.json();
    },
    onMutate: (workTypeId: number) => {
      setAnalyzingWorkTypeId(workTypeId);
    },
    onSuccess: (data) => {
      setRiskAssessmentData(data);
      setShowRiskAssessment(true);
      setAnalyzingWorkTypeId(null);
    },
    onError: (error) => {
      console.error('Risk assessment error:', error);
      setAnalyzingWorkTypeId(null);
      toast({
        title: "오류",
        description: "위험성 평가를 수행할 수 없습니다.",
        variant: "destructive",
      });
    }
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: { equipmentId: number; workTypeId: number; workerName: string }) => {
      const response = await apiRequest("POST", "/api/work-sessions", data);
      return response.json();
    },
    onSuccess: (session) => {
      toast({
        title: "작업 시작",
        description: "작업 세션이 생성되었습니다.",
      });
      setLocation(`/work-session/${session.id}`);
    },
    onError: (error) => {
      toast({
        title: "오류",
        description: "작업 세션을 생성할 수 없습니다.",
        variant: "destructive",
      });
    }
  });

  const handleWorkTypeSelect = (workType: WorkType) => {
    setSelectedWorkType(workType);
    setShowChecklist(true);
    
    // Initialize checklist items
    const items: Record<string, boolean> = {};
    workType.requiredQualifications?.forEach(qual => {
      items[`qual_${qual}`] = false;
    });
    workType.requiredEquipment?.forEach(eq => {
      items[`equip_${eq}`] = false;
    });
    workType.requiredTools?.forEach(tool => {
      items[`tool_${tool}`] = false;
    });
    workType.environmentalRequirements?.forEach(env => {
      items[`env_${env}`] = false;
    });
    workType.legalRequirements?.forEach(legal => {
      items[`legal_${legal}`] = false;
    });
    setChecklistItems(items);
  };

  const handleChecklistSubmit = () => {
    const allChecked = Object.values(checklistItems).every(checked => checked);
    
    if (!allChecked) {
      toast({
        title: "점검 미완료",
        description: "모든 항목을 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!workerName.trim()) {
      toast({
        title: "작업자 이름 필수",
        description: "작업자 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (selectedWorkType) {
      createSessionMutation.mutate({
        equipmentId: equipmentIdNum,
        workTypeId: selectedWorkType.id,
        workerName: workerName.trim()
      });
    }
  };

  const handleRiskAssessment = (workTypeId: number) => {
    if (analyzingWorkTypeId !== null) {
      toast({
        title: "분석 진행 중",
        description: "현재 다른작업의 위험성 평가를 수행중입니다",
        variant: "destructive",
      });
      return;
    }
    riskAssessmentMutation.mutate(workTypeId);
  };

  const getPermitStatusBadge = (requiresPermit: boolean) => {
    if (requiresPermit) {
      return <Badge variant="secondary" className="bg-warning text-white">허가 필요</Badge>;
    }
    return <Badge variant="secondary" className="bg-success text-white">허가 불필요</Badge>;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">작업 유형을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 min-h-screen bg-gray-50">
      <div className="flex items-center mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/equipment/${equipmentId}`)}
          className="text-gray-600 hover:bg-gray-100 p-1 mr-3"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-medium">작업 유형 선택</h2>
      </div>

      <div className="space-y-3">
        {workTypes?.map((workType) => (
          <Card 
            key={workType.id}
            className="card-minimal card-hover"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">{workType.name}</h3>
                  <p className="text-sm text-gray-600">{workType.description}</p>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  {getPermitStatusBadge(workType.requiresPermit || false)}
                  <ChevronRight className="text-gray-400 h-5 w-5" />
                </div>
              </div>
              
              <div className="flex items-center text-xs mb-4">
                <Clock className="text-sm mr-1 text-warning h-4 w-4" />
                <span>소요시간: {workType.estimatedDuration || 30}분</span>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleWorkTypeSelect(workType)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <ChevronRight className="w-4 h-4 mr-2" />
                  작업 시작
                </Button>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRiskAssessment(workType.id);
                  }}
                  disabled={analyzingWorkTypeId !== null}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3"
                >
                  <BarChart3 className="h-4 w-4" />
                  {analyzingWorkTypeId === workType.id ? '분석중...' : 'AI 위험성평가'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Incidents for Work Types */}
      {incidents && incidents.length > 0 && (
        <Card className="mt-8 material-shadow">
          <CardContent className="p-6">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center">
              <AlertTriangleIcon className="mr-2 h-5 w-5 text-warning" />
              작업별 주요 사고 이력
            </h3>
            <div className="space-y-3">
              {(incidents as Incident[]).slice(0, 2).map((incident) => (
                <div 
                  key={incident.id} 
                  className={`rounded-lg p-3 border ${
                    incident.severity === 'HIGH' ? 'bg-red-50 border-red-200' : 
                    incident.severity === 'MEDIUM' ? 'bg-orange-50 border-orange-200' : 
                    'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    incident.severity === 'HIGH' ? 'text-danger' : 
                    incident.severity === 'MEDIUM' ? 'text-warning' : 
                    'text-gray-700'
                  }`}>
                    {incident.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(incident.incidentDate).toLocaleDateString('ko-KR')} - {incident.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-work Checklist Modal */}
      <Dialog open={showChecklist} onOpenChange={setShowChecklist}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>작업 전 점검사항</DialogTitle>
          </DialogHeader>

          {selectedWorkType && (
            <div className="space-y-6">
              {/* Qualification Check */}
              {selectedWorkType.requiredQualifications && selectedWorkType.requiredQualifications.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="material-icons mr-2 text-primary">verified_user</span>
                    자격 요건
                  </h4>
                  <div className="space-y-2 ml-8">
                    {selectedWorkType.requiredQualifications.map((qual, index) => (
                      <label key={index} className="flex items-center space-x-3">
                        <Checkbox
                          checked={checklistItems[`qual_${qual}`] || false}
                          onCheckedChange={(checked) => 
                            setChecklistItems(prev => ({ ...prev, [`qual_${qual}`]: !!checked }))
                          }
                        />
                        <span className="text-sm">{qual}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipment Check */}
              {selectedWorkType.requiredEquipment && selectedWorkType.requiredEquipment.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="material-icons mr-2 text-primary">build</span>
                    안전 장비
                  </h4>
                  <div className="space-y-2 ml-8">
                    {selectedWorkType.requiredEquipment.map((equip, index) => (
                      <label key={index} className="flex items-center space-x-3">
                        <Checkbox
                          checked={checklistItems[`equip_${equip}`] || false}
                          onCheckedChange={(checked) => 
                            setChecklistItems(prev => ({ ...prev, [`equip_${equip}`]: !!checked }))
                          }
                        />
                        <span className="text-sm">{equip}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Tools Check */}
              {selectedWorkType.requiredTools && selectedWorkType.requiredTools.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="material-icons mr-2 text-primary">construction</span>
                    필수 작업도구
                  </h4>
                  <div className="space-y-2 ml-8">
                    {selectedWorkType.requiredTools.map((tool, index) => (
                      <label key={index} className="flex items-center space-x-3">
                        <Checkbox
                          checked={checklistItems[`tool_${tool}`] || false}
                          onCheckedChange={(checked) => 
                            setChecklistItems(prev => ({ ...prev, [`tool_${tool}`]: !!checked }))
                          }
                        />
                        <span className="text-sm">{tool}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Environment Check */}
              {selectedWorkType.environmentalRequirements && selectedWorkType.environmentalRequirements.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="material-icons mr-2 text-primary">eco</span>
                    환경 조건
                  </h4>
                  <div className="space-y-2 ml-8">
                    {selectedWorkType.environmentalRequirements.map((env, index) => (
                      <label key={index} className="flex items-center space-x-3">
                        <Checkbox
                          checked={checklistItems[`env_${env}`] || false}
                          onCheckedChange={(checked) => 
                            setChecklistItems(prev => ({ ...prev, [`env_${env}`]: !!checked }))
                          }
                        />
                        <span className="text-sm">{env}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal Requirements */}
              {selectedWorkType.legalRequirements && selectedWorkType.legalRequirements.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="material-icons mr-2 text-primary">gavel</span>
                    법적 사항
                  </h4>
                  <div className="space-y-2 ml-8">
                    {selectedWorkType.legalRequirements.map((legal, index) => (
                      <label key={index} className="flex items-center space-x-3">
                        <Checkbox
                          checked={checklistItems[`legal_${legal}`] || false}
                          onCheckedChange={(checked) => 
                            setChecklistItems(prev => ({ ...prev, [`legal_${legal}`]: !!checked }))
                          }
                        />
                        <span className="text-sm">{legal}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Worker Name Input */}
              <div>
                <Label htmlFor="workerName" className="text-sm font-medium text-gray-900 mb-2 block">
                  작업자 이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="workerName"
                  type="text"
                  placeholder="작업자 이름을 입력해주세요"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowChecklist(false)}
                >
                  취소
                </Button>
                <Button 
                  className="flex-1 bg-primary hover:bg-primary/90" 
                  onClick={handleChecklistSubmit}
                  disabled={createSessionMutation.isPending}
                >
                  {createSessionMutation.isPending ? "생성 중..." : "작업 시작"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Risk Assessment Popup */}
      {showRiskAssessment && riskAssessmentData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">AI 위험성평가 결과 - {riskAssessmentData.workTypeName}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowRiskAssessment(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              {/* Risk Assessment Results Count */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-center text-gray-700 font-medium">
                  {riskAssessmentData.riskFactors.length}개의 위험성평가 결과가 도출되었습니다
                </p>
              </div>

              {/* Risk Factors */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">위험요소별 평가</h4>
                <div className="space-y-4">
                  {riskAssessmentData.riskFactors.map((risk, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h5 className="font-medium text-gray-800">{risk.factor}</h5>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            발생가능성: {risk.probability}/5 × 심각도: {risk.severity}/4
                          </div>
                          <div className="font-bold text-lg">
                            위험점수: {risk.score}/20점
                          </div>
                        </div>
                      </div>
                      <div>
                        <h6 className="text-sm font-medium text-gray-700 mb-2">대응조치:</h6>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {risk.measures.map((measure, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-blue-600 mr-2">•</span>
                              {measure}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compliance Notes */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">산업안전보건법 준수사항</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  {riskAssessmentData.complianceNotes.map((note, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
