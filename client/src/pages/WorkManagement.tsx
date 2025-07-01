import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Settings,
  FileText,
  CheckCircle,
  AlertTriangle,
  Wrench
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Equipment, WorkType, WorkProcedure, InsertWorkType, InsertWorkProcedure } from "@shared/schema";

export default function WorkManagement() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedWorkType, setSelectedWorkType] = useState<WorkType | null>(null);
  const [isAddingWorkType, setIsAddingWorkType] = useState(false);
  const [isAddingProcedure, setIsAddingProcedure] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<WorkProcedure | null>(null);
  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [editingWorkTypeId, setEditingWorkTypeId] = useState<number | null>(null);
  
  // Work Type Form States
  const [workTypeName, setWorkTypeName] = useState("");
  const [workTypeDescription, setWorkTypeDescription] = useState("");
  const [requiresPermit, setRequiresPermit] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState("");
  
  // Procedure Form States
  const [procedureTitle, setProcedureTitle] = useState("");
  const [procedureDescription, setProcedureDescription] = useState("");
  const [procedureStepNumber, setProcedureStepNumber] = useState(1);
  const [procedureCategory, setProcedureCategory] = useState<"기기조작" | "상태인지" | "안전조치">("기기조작");
  const [safetyNotes, setSafetyNotes] = useState("");
  
  // Checklist Form States
  const [requiredQualifications, setRequiredQualifications] = useState<string[]>([]);
  const [safetyEquipmentRequirements, setSafetyEquipmentRequirements] = useState<string[]>([]);
  const [environmentalRequirements, setEnvironmentalRequirements] = useState<string[]>([]);
  const [legalRequirements, setLegalRequirements] = useState<string[]>([]);
  const [newQualification, setNewQualification] = useState("");
  const [newSafetyEquipment, setNewSafetyEquipment] = useState("");
  const [newEnvironmentalReq, setNewEnvironmentalReq] = useState("");
  const [newLegalReq, setNewLegalReq] = useState("");

  // Fetch equipment data
  const { data: equipment, isLoading: equipmentLoading } = useQuery<Equipment>({
    queryKey: ["/api/equipment", equipmentId],
    enabled: !!equipmentId,
  });

  // Fetch work types for this equipment
  const { data: workTypes = [], isLoading: workTypesLoading } = useQuery<WorkType[]>({
    queryKey: [`/api/equipment/${equipmentId}/work-types`],
    enabled: !!equipmentId,
  });

  // Fetch procedures for selected work type
  const { data: procedures = [], isLoading: proceduresLoading } = useQuery<WorkProcedure[]>({
    queryKey: [`/api/work-types/${selectedWorkType?.id}/procedures`],
    enabled: !!selectedWorkType?.id,
  });



  // Mutations
  const createWorkTypeMutation = useMutation({
    mutationFn: async (data: InsertWorkType) => {
      return apiRequest("POST", `/api/work-types`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment", equipmentId, "work-types"] });
      setIsAddingWorkType(false);
      resetWorkTypeForm();
      toast({ title: "작업 유형이 생성되었습니다" });
    },
  });

  const createProcedureMutation = useMutation({
    mutationFn: async (data: InsertWorkProcedure) => {
      return apiRequest("POST", `/api/work-procedures`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/work-types/${selectedWorkType?.id}/procedures`] });
      setIsAddingProcedure(false);
      setEditingProcedure(null);
      resetProcedureForm();
      toast({ title: "작업 절차가 생성되었습니다" });
    },
  });

  const updateProcedureMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertWorkProcedure> }) => {
      return apiRequest("PATCH", `/api/work-procedures/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/work-types/${selectedWorkType?.id}/procedures`] });
      setEditingProcedure(null);
      setIsAddingProcedure(false);
      resetProcedureForm();
      toast({ title: "작업 절차가 수정되었습니다" });
    },
  });

  const deleteProcedureMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/work-procedures/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/work-types/${selectedWorkType?.id}/procedures`] });
      toast({ title: "작업 절차가 삭제되었습니다" });
    },
  });

  const deleteWorkTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/work-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment", equipmentId, "work-types"] });
      setSelectedWorkType(null);
      toast({ title: "작업 유형이 삭제되었습니다" });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ id, data }: { 
      id: number; 
      data: {
        requiredQualifications?: string[];
        requiredEquipment?: string[];
        environmentalRequirements?: string[];
        legalRequirements?: string[];
      } 
    }) => {
      return apiRequest("PATCH", `/api/work-types/${id}/checklist`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/equipment/${equipmentId}/work-types`] });
      setIsEditingChecklist(false);
      setEditingWorkTypeId(null);
      toast({ title: "작업 전 점검사항이 수정되었습니다" });
    },
  });

  // Form reset functions
  const resetWorkTypeForm = () => {
    setWorkTypeName("");
    setWorkTypeDescription("");
    setRequiresPermit(false);
    setEstimatedDuration("");
  };

  const resetProcedureForm = () => {
    setProcedureTitle("");
    setProcedureDescription("");
    setProcedureStepNumber(1);
    setProcedureCategory("기기조작");
    setSafetyNotes("");
  };

  const resetChecklistForm = () => {
    setRequiredQualifications([]);
    setSafetyEquipmentRequirements([]);
    setEnvironmentalRequirements([]);
    setLegalRequirements([]);
    setNewQualification("");
    setNewSafetyEquipment("");
    setNewEnvironmentalReq("");
    setNewLegalReq("");
  };

  // Checklist editing functions
  const handleEditChecklist = (workType: WorkType) => {
    setEditingWorkTypeId(workType.id);
    setRequiredQualifications(workType.requiredQualifications || []);
    setSafetyEquipmentRequirements(workType.requiredEquipment || []);
    setEnvironmentalRequirements(workType.environmentalRequirements || []);
    setLegalRequirements(workType.legalRequirements || []);
    setIsEditingChecklist(true);
  };

  const handleSaveChecklist = () => {
    if (!editingWorkTypeId) return;

    updateChecklistMutation.mutate({
      id: editingWorkTypeId,
      data: {
        requiredQualifications,
        requiredEquipment: safetyEquipmentRequirements,
        environmentalRequirements,
        legalRequirements,
      },
    });
  };

  const handleCancelEditChecklist = () => {
    setIsEditingChecklist(false);
    setEditingWorkTypeId(null);
    resetChecklistForm();
  };

  // Functions to add/remove checklist items
  const addQualification = () => {
    if (newQualification.trim()) {
      setRequiredQualifications([...requiredQualifications, newQualification.trim()]);
      setNewQualification("");
    }
  };

  const removeQualification = (index: number) => {
    setRequiredQualifications(requiredQualifications.filter((_, i) => i !== index));
  };

  const addSafetyEquipment = () => {
    if (newSafetyEquipment.trim()) {
      setSafetyEquipmentRequirements([...safetyEquipmentRequirements, newSafetyEquipment.trim()]);
      setNewSafetyEquipment("");
    }
  };

  const removeSafetyEquipment = (index: number) => {
    setSafetyEquipmentRequirements(safetyEquipmentRequirements.filter((_, i) => i !== index));
  };

  const addEnvironmentalReq = () => {
    if (newEnvironmentalReq.trim()) {
      setEnvironmentalRequirements([...environmentalRequirements, newEnvironmentalReq.trim()]);
      setNewEnvironmentalReq("");
    }
  };

  const removeEnvironmentalReq = (index: number) => {
    setEnvironmentalRequirements(environmentalRequirements.filter((_, i) => i !== index));
  };

  const addLegalReq = () => {
    if (newLegalReq.trim()) {
      setLegalRequirements([...legalRequirements, newLegalReq.trim()]);
      setNewLegalReq("");
    }
  };

  const removeLegalReq = (index: number) => {
    setLegalRequirements(legalRequirements.filter((_, i) => i !== index));
  };

  // Form handlers
  const handleCreateWorkType = () => {
    if (!workTypeName.trim()) {
      toast({ title: "작업 유형명을 입력하세요", variant: "destructive" });
      return;
    }

    const workTypeData: InsertWorkType = {
      name: workTypeName,
      description: workTypeDescription || null,
      equipmentId: Number(equipmentId),
      requiresPermit: requiresPermit,
      estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
      requiredQualifications: [],
      requiredEquipment: [],
      environmentalRequirements: [],
      legalRequirements: [],
    };

    createWorkTypeMutation.mutate(workTypeData);
  };

  const handleCreateProcedure = () => {
    if (!procedureTitle.trim() || !procedureDescription.trim()) {
      toast({ title: "제목과 설명을 모두 입력하세요", variant: "destructive" });
      return;
    }

    if (!selectedWorkType) {
      toast({ title: "작업 유형을 선택하세요", variant: "destructive" });
      return;
    }

    const procedureData: InsertWorkProcedure = {
      title: procedureTitle,
      description: procedureDescription,
      workTypeId: selectedWorkType.id,
      stepNumber: procedureStepNumber,
      category: procedureCategory,
      checklistItems: [],
      safetyNotes: safetyNotes || null,
    };

    if (editingProcedure) {
      updateProcedureMutation.mutate({ id: editingProcedure.id, data: procedureData });
    } else {
      createProcedureMutation.mutate(procedureData);
    }
  };

  const handleEditProcedure = (procedure: WorkProcedure) => {
    setEditingProcedure(procedure);
    setProcedureTitle(procedure.title);
    setProcedureDescription(procedure.description);
    setProcedureStepNumber(procedure.stepNumber);
    setProcedureCategory(procedure.category as "기기조작" | "상태인지" | "안전조치");
    setSafetyNotes(procedure.safetyNotes || "");
    setIsAddingProcedure(true);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "기기조작": return "bg-green-100 text-green-800";
      case "상태인지": return "bg-yellow-100 text-yellow-800";
      case "안전조치": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (equipmentLoading) return <div className="p-4">설비 정보를 불러오는 중...</div>;
  if (!equipment) return <div className="p-4">설비를 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/admin`)}
            className="text-primary-foreground hover:bg-primary/80"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">작업 관리</h1>
            {equipment && (
              <p className="text-primary-100">{equipment.name}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Work Types Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                작업 유형 관리
              </CardTitle>
              <Dialog open={isAddingWorkType} onOpenChange={setIsAddingWorkType}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    작업 유형 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>새 작업 유형 추가</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="workTypeName">작업 유형명</Label>
                      <Input
                        id="workTypeName"
                        value={workTypeName}
                        onChange={(e) => setWorkTypeName(e.target.value)}
                        placeholder="예: 정기점검, 예방보전"
                      />
                    </div>
                    <div>
                      <Label htmlFor="workTypeDescription">설명</Label>
                      <Textarea
                        id="workTypeDescription"
                        value={workTypeDescription}
                        onChange={(e) => setWorkTypeDescription(e.target.value)}
                        placeholder="작업 유형에 대한 설명"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="requiresPermit">작업허가서 필요</Label>
                        <Select onValueChange={(value) => setRequiresPermit(value === "true")}>
                          <SelectTrigger>
                            <SelectValue placeholder="선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">불필요</SelectItem>
                            <SelectItem value="true">필요</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="estimatedDuration">예상 소요시간 (분)</Label>
                        <Input
                          id="estimatedDuration"
                          type="number"
                          value={estimatedDuration}
                          onChange={(e) => setEstimatedDuration(e.target.value)}
                          placeholder="60"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreateWorkType} disabled={createWorkTypeMutation.isPending}>
                        {createWorkTypeMutation.isPending ? "생성 중..." : "생성"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddingWorkType(false)}>
                        취소
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {workTypesLoading ? (
              <div>작업 유형을 불러오는 중...</div>
            ) : workTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                등록된 작업 유형이 없습니다. 새 작업 유형을 추가해보세요.
              </div>
            ) : (
              <div className="grid gap-3">
                {workTypes.map((workType: WorkType) => (
                  <div key={workType.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{workType.name}</h3>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEditChecklist(workType)}
                          title="작업 전 점검사항 편집"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setSelectedWorkType(workType)}
                          title="작업 절차 관리"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => deleteWorkTypeMutation.mutate(workType.id)}
                          disabled={deleteWorkTypeMutation.isPending}
                          title="작업 유형 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {workType.description && (
                      <p className="text-sm text-gray-600 mb-2">{workType.description}</p>
                    )}
                    <div className="flex gap-4 text-sm text-gray-500">
                      {workType.requiresPermit && <span>작업허가서 필요</span>}
                      {workType.estimatedDuration && <span>{workType.estimatedDuration}분</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Procedures Section */}
        {selectedWorkType && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  작업 절차 관리 - {selectedWorkType.name}
                </CardTitle>
                <Dialog open={isAddingProcedure} onOpenChange={(open) => {
                  setIsAddingProcedure(open);
                  if (!open) {
                    setEditingProcedure(null);
                    resetProcedureForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      절차 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingProcedure ? "작업 절차 수정" : "새 작업 절차 추가"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="procedureTitle">작업 단계명</Label>
                          <Input
                            id="procedureTitle"
                            value={procedureTitle}
                            onChange={(e) => setProcedureTitle(e.target.value)}
                            placeholder="예: 전원 차단"
                          />
                        </div>
                        <div>
                          <Label htmlFor="procedureStepNumber">단계 번호</Label>
                          <Input
                            id="procedureStepNumber"
                            type="number"
                            value={procedureStepNumber}
                            onChange={(e) => setProcedureStepNumber(Number(e.target.value))}
                            placeholder="1"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="procedureCategory">카테고리</Label>
                        <Select onValueChange={(value: "기기조작" | "상태인지" | "안전조치") => setProcedureCategory(value)} value={procedureCategory}>
                          <SelectTrigger>
                            <SelectValue placeholder="카테고리 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="기기조작">기기조작</SelectItem>
                            <SelectItem value="상태인지">상태인지</SelectItem>
                            <SelectItem value="안전조치">안전조치</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="procedureDescription">작업 설명</Label>
                        <Textarea
                          id="procedureDescription"
                          value={procedureDescription}
                          onChange={(e) => setProcedureDescription(e.target.value)}
                          placeholder="상세한 작업 설명을 입력하세요"
                        />
                      </div>

                      <div>
                        <Label htmlFor="safetyNotes">안전 주의사항</Label>
                        <Textarea
                          id="safetyNotes"
                          value={safetyNotes}
                          onChange={(e) => setSafetyNotes(e.target.value)}
                          placeholder="안전 관련 주의사항을 입력하세요"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleCreateProcedure} disabled={createProcedureMutation.isPending || updateProcedureMutation.isPending}>
                          {(createProcedureMutation.isPending || updateProcedureMutation.isPending) 
                            ? "저장 중..." 
                            : editingProcedure ? "수정" : "생성"}
                        </Button>
                        <Button variant="outline" onClick={() => setIsAddingProcedure(false)}>
                          취소
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {proceduresLoading ? (
                <div>작업 절차를 불러오는 중...</div>
              ) : procedures.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  등록된 작업 절차가 없습니다. 새 절차를 추가해보세요.
                </div>
              ) : (
                <div className="space-y-3">
                  {procedures
                    .sort((a: WorkProcedure, b: WorkProcedure) => a.stepNumber - b.stepNumber)
                    .map((procedure: WorkProcedure) => (
                    <div key={procedure.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {procedure.stepNumber}
                          </Badge>
                          <Badge className={getCategoryColor(procedure.category)}>
                            {procedure.category}
                          </Badge>
                          <h3 className="font-medium">{procedure.title}</h3>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleEditProcedure(procedure)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => deleteProcedureMutation.mutate(procedure.id)}
                            disabled={deleteProcedureMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{procedure.description}</p>
                      {procedure.safetyNotes && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mt-2">
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <p className="text-xs font-medium text-yellow-800">안전 주의사항</p>
                          </div>
                          <p className="text-xs text-yellow-700 mt-1">{procedure.safetyNotes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Checklist Edit Dialog */}
        <Dialog open={isEditingChecklist} onOpenChange={(open) => {
          if (!open) {
            handleCancelEditChecklist();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>작업 전 점검사항 편집</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Required Qualifications */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4" />
                  필수 자격 요건
                </Label>
                <div className="space-y-2">
                  {requiredQualifications.map((qual, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input 
                        value={qual} 
                        onChange={(e) => {
                          const updated = [...requiredQualifications];
                          updated[index] = e.target.value;
                          setRequiredQualifications(updated);
                        }}
                        className="flex-1" 
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeQualification(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="새 자격 요건 추가"
                      value={newQualification}
                      onChange={(e) => setNewQualification(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addQualification()}
                    />
                    <Button onClick={addQualification} disabled={!newQualification.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Safety Equipment Requirements */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  안전장비 요구사항
                </Label>
                <div className="space-y-2">
                  {safetyEquipmentRequirements.map((equip, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input 
                        value={equip} 
                        onChange={(e) => {
                          const updated = [...safetyEquipmentRequirements];
                          updated[index] = e.target.value;
                          setSafetyEquipmentRequirements(updated);
                        }}
                        className="flex-1" 
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeSafetyEquipment(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="새 안전장비 요구사항 추가"
                      value={newSafetyEquipment}
                      onChange={(e) => setNewSafetyEquipment(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addSafetyEquipment()}
                    />
                    <Button onClick={addSafetyEquipment} disabled={!newSafetyEquipment.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Environmental Requirements */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Settings className="h-4 w-4" />
                  환경 요구사항
                </Label>
                <div className="space-y-2">
                  {environmentalRequirements.map((env, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input 
                        value={env} 
                        onChange={(e) => {
                          const updated = [...environmentalRequirements];
                          updated[index] = e.target.value;
                          setEnvironmentalRequirements(updated);
                        }}
                        className="flex-1" 
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeEnvironmentalReq(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="새 환경 요구사항 추가"
                      value={newEnvironmentalReq}
                      onChange={(e) => setNewEnvironmentalReq(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addEnvironmentalReq()}
                    />
                    <Button onClick={addEnvironmentalReq} disabled={!newEnvironmentalReq.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Legal Requirements */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4" />
                  법적 요구사항
                </Label>
                <div className="space-y-2">
                  {legalRequirements.map((legal, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input 
                        value={legal} 
                        onChange={(e) => {
                          const updated = [...legalRequirements];
                          updated[index] = e.target.value;
                          setLegalRequirements(updated);
                        }}
                        className="flex-1" 
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeLegalReq(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="새 법적 요구사항 추가"
                      value={newLegalReq}
                      onChange={(e) => setNewLegalReq(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addLegalReq()}
                    />
                    <Button onClick={addLegalReq} disabled={!newLegalReq.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={handleCancelEditChecklist}>
                  취소
                </Button>
                <Button 
                  onClick={handleSaveChecklist} 
                  disabled={updateChecklistMutation.isPending}
                >
                  {updateChecklistMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}