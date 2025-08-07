import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useEquipment } from "@/hooks/useEquipment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEquipmentSchema, type InsertEquipment, type Equipment } from "@shared/schema";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import RiskLevelBadge from "@/components/RiskLevelBadge";
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Edit, 
  Settings,
  Phone,
  Trash2,
  Factory,
  Shield,
  AlertTriangle,
  Database
} from "lucide-react";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [newIncidents, setNewIncidents] = useState<{
    id?: number; // For existing incidents
    description: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    occurredAt: string;
    reportedBy: string;
    actions: string;
  }[]>([]);
  
  const { data: equipment, isLoading } = useEquipment();

  const form = useForm<InsertEquipment>({
    resolver: zodResolver(insertEquipmentSchema),
    defaultValues: {
      name: "",
      code: "",
      location: "",
      installYear: null,
      manufacturer: "",
      modelName: "",
      riskLevel: "GREEN",
      riskFactors: {
        highVoltage: false,
        highPressure: false,
        highTemperature: false,
        height: false,
        mechanical: false,
        highVoltageDetail: "",
        highPressureDetail: "",
        highTemperatureDetail: "",
        heightDetail: "",
        mechanicalDetail: ""
      },
      requiredSafetyEquipment: [],
      emergencyContacts: [],
      hazardousChemicalType: "",
      hazardousChemicalName: "",
      msdsImageUrl: "",
      safetyFacilityLocations: [],
      imageUrl: ""
    }
  });

  const editForm = useForm<InsertEquipment>({
    resolver: zodResolver(insertEquipmentSchema),
    defaultValues: {
      name: "",
      code: "",
      location: "",
      installYear: null,
      manufacturer: "",
      modelName: "",
      riskLevel: "GREEN",
      riskFactors: {
        highVoltage: false,
        highPressure: false,
        highTemperature: false,
        height: false,
        mechanical: false,
        highVoltageDetail: "",
        highPressureDetail: "",
        highTemperatureDetail: "",
        heightDetail: "",
        mechanicalDetail: ""
      },
      requiredSafetyEquipment: [],
      emergencyContacts: [],
      hazardousChemicalType: "",
      hazardousChemicalName: "",
      msdsImageUrl: "",
      safetyFacilityLocations: [],
      imageUrl: ""
    }
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async (data: InsertEquipment) => {
      const response = await apiRequest("POST", "/api/equipment", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setShowAddDialog(false);
      form.reset();
      toast({
        title: "설비 추가 완료",
        description: "새로운 설비가 성공적으로 추가되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "설비 추가 실패",
        description: "설비 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async (data: InsertEquipment) => {
      if (!editingEquipment) throw new Error("No equipment selected for editing");
      const response = await apiRequest("PATCH", `/api/equipment/${editingEquipment.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setShowEditDialog(false);
      setEditingEquipment(null);
      editForm.reset();
      toast({
        title: "설비 수정 완료",
        description: "설비 정보가 성공적으로 수정되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "설비 수정 실패",
        description: "설비 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: number) => {
      const response = await apiRequest("DELETE", `/api/equipment/${equipmentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "설비 삭제 완료",
        description: "설비가 성공적으로 삭제되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "설비 삭제 실패",
        description: "설비 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteEquipment = (equipment: Equipment) => {
    if (window.confirm(`"${equipment.name}" 설비를 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      deleteEquipmentMutation.mutate(equipment.id);
    }
  };

  const onSubmit = (data: InsertEquipment) => {
    createEquipmentMutation.mutate(data);
  };

  const onEditSubmit = async (data: InsertEquipment) => {
    console.log("편집 폼 제출 데이터:", data);
    console.log("riskFactors:", data.riskFactors);
    
    // First update the equipment
    updateEquipmentMutation.mutate(data, {
      onSuccess: async () => {
        // Then handle incidents (update existing and create new ones)
        if (newIncidents.length > 0 && editingEquipment) {
          try {
            for (const incident of newIncidents) {
              if (incident.id) {
                // Update existing incident - map fields to database schema
                await apiRequest("PUT", `/api/incidents/${incident.id}`, {
                  description: incident.description,
                  severity: incident.severity,
                  incidentDate: new Date(incident.occurredAt).toISOString(),
                  reporterName: incident.reportedBy,
                  actionsTaken: incident.actions,
                });
              } else {
                // Create new incident - map fields to database schema
                await apiRequest("POST", "/api/incidents", {
                  description: incident.description,
                  severity: incident.severity,
                  incidentDate: new Date(incident.occurredAt).toISOString(),
                  reporterName: incident.reportedBy,
                  actionsTaken: incident.actions,
                  equipmentId: editingEquipment.id,
                  workTypeId: null
                });
              }
            }
            // Clear the incidents array after saving
            setNewIncidents([]);
            // Invalidate incidents query to refresh the dashboard
            queryClient.invalidateQueries({ queryKey: [`/api/equipment/${editingEquipment.id}/incidents`] });
            
            toast({
              title: "저장 완료",
              description: `설비 정보와 ${newIncidents.length}건의 사고이력이 저장되었습니다.`,
            });
          } catch (error) {
            console.error("사고이력 저장 오류:", error);
            toast({
              title: "사고이력 저장 실패",
              description: "사고이력 저장 중 오류가 발생했습니다.",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "저장 완료",
            description: "설비 정보가 성공적으로 업데이트되었습니다.",
          });
        }
      }
    });
  };

  const handleEditEquipment = async (equipment: Equipment) => {
    setEditingEquipment(equipment);
    editForm.reset({
      name: equipment.name,
      code: equipment.code,
      location: equipment.location,
      installYear: equipment.installYear,
      manufacturer: equipment.manufacturer,
      modelName: equipment.modelName,
      riskLevel: equipment.riskLevel,
      riskFactors: equipment.riskFactors || {
        highVoltage: equipment.highVoltageRisk || false,
        highPressure: equipment.highPressureRisk || false,
        highTemperature: equipment.highTemperatureRisk || false,
        height: equipment.heightRisk || false,
        mechanical: equipment.heavyWeightRisk || false,
        highVoltageDetail: equipment.highVoltageDetails || "",
        highPressureDetail: equipment.highPressureDetails || "",
        highTemperatureDetail: equipment.highTemperatureDetails || "",
        heightDetail: equipment.heightDetails || "",
        mechanicalDetail: equipment.heavyWeightDetails || ""
      },
      requiredSafetyEquipment: Array.isArray(equipment.requiredSafetyEquipment) 
        ? equipment.requiredSafetyEquipment 
        : [],
      emergencyContacts: Array.isArray(equipment.emergencyContacts) 
        ? equipment.emergencyContacts 
        : equipment.emergencyContacts 
          ? Object.entries(equipment.emergencyContacts).map(([role, contact]) => ({ role, contact: contact as string }))
          : [],
      hazardousChemicalType: equipment.hazardousChemicalType || "",
      hazardousChemicalName: equipment.hazardousChemicalName || "",
      msdsImageUrl: equipment.msdsImageUrl || "",
      safetyFacilityLocations: Array.isArray(equipment.safetyFacilityLocations) 
        ? equipment.safetyFacilityLocations 
        : [],
      imageUrl: equipment.imageUrl || ""
    });
    
    // Load existing incidents for this equipment
    try {
      const response = await fetch(`/api/equipment/${equipment.id}/incidents`);
      if (response.ok) {
        const incidents = await response.json();
        console.log("Loaded incidents:", incidents);
        
        // Convert existing incidents to the format expected by newIncidents state
        const existingIncidents = incidents.map((incident: any) => ({
          id: incident.id, // Keep track of existing incident IDs
          description: incident.description || "",
          severity: incident.severity || "MEDIUM",
          occurredAt: incident.incidentDate ? new Date(incident.incidentDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
          reportedBy: incident.reporterName || "",
          actions: incident.actionsTaken || ""
        }));
        
        console.log("Converted incidents:", existingIncidents);
        setNewIncidents(existingIncidents);
      } else {
        console.error("Failed to load incidents: HTTP", response.status);
        setNewIncidents([]);
      }
    } catch (error) {
      console.error("Failed to load incidents:", error);
      setNewIncidents([]);
    }
    
    setShowEditDialog(true);
  };

  const filteredEquipment = equipment?.filter((eq) => {
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = filterRisk === "all" || eq.riskLevel === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const riskCounts = equipment?.reduce((acc, eq) => {
    acc.total++;
    if (eq.riskLevel === "HIGH") acc.high++;
    else if (eq.riskLevel === "MEDIUM") acc.medium++;
    else acc.low++;
    return acc;
  }, { total: 0, high: 0, medium: 0, low: 0 }) || { total: 0, high: 0, medium: 0, low: 0 };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-lg text-gray-700">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-heading-1 text-white mb-2">설비 관리</h1>
            <p className="text-body text-blue-50">산업 설비의 안전 정보를 관리합니다</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Vector DB Status Button */}
            <Button 
              onClick={() => setLocation('/vector-db-status')}
              className="bg-white/10 text-white hover:bg-white/20 border border-white/20"
            >
              <Database className="mr-2 h-4 w-4" />
              벡터DB상태확인
            </Button>
            
            {/* Add Equipment Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-white text-primary hover:bg-blue-50 border-0">
                  <Plus className="mr-2 h-4 w-4" />
                  설비 추가
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Add Equipment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>새 설비 추가</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설비명</FormLabel>
                        <FormControl>
                          <Input placeholder="예: 압축기" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설비코드</FormLabel>
                        <FormControl>
                          <Input placeholder="예: A-101" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>위치</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 1층 생산라인" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="installYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설치년도</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="예: 2020" 
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>제조사</FormLabel>
                        <FormControl>
                          <Input placeholder="예: 한국산업" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="modelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>모델명</FormLabel>
                        <FormControl>
                          <Input placeholder="예: KIC-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>설비 이미지 URL</FormLabel>
                      <FormControl>
                        <Input placeholder="예: /attached_assets/compressor.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="riskLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>위험도 등급</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="위험도를 선택하세요" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="RED">RED (고위험)</SelectItem>
                          <SelectItem value="YELLOW">YELLOW (중위험)</SelectItem>
                          <SelectItem value="GREEN">GREEN (저위험)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Risk Factors */}
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-base font-medium">위험요소</Label>
                  
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="riskFactors.highVoltage"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="highVoltage"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="highVoltage" className="text-sm font-medium">
                              고전압
                            </Label>
                          </div>
                          {form.watch("riskFactors.highVoltage") && (
                            <FormField
                              control={form.control}
                              name="riskFactors.highVoltageDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">고전압 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="고전압에 대한 상세 정보를 입력하세요 (전압 수준, 안전 조치 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskFactors.highPressure"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="highPressure"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="highPressure" className="text-sm font-medium">
                              고압
                            </Label>
                          </div>
                          {form.watch("riskFactors.highPressure") && (
                            <FormField
                              control={form.control}
                              name="riskFactors.highPressureDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">고압 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="고압에 대한 상세 정보를 입력하세요 (압력 수준, 안전 밸브 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskFactors.highTemperature"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="highTemperature"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="highTemperature" className="text-sm font-medium">
                              고온
                            </Label>
                          </div>
                          {form.watch("riskFactors.highTemperature") && (
                            <FormField
                              control={form.control}
                              name="riskFactors.highTemperatureDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">고온 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="고온에 대한 상세 정보를 입력하세요 (온도 범위, 보호 장비 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskFactors.height"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="height"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="height" className="text-sm font-medium">
                              고소작업
                            </Label>
                          </div>
                          {form.watch("riskFactors.height") && (
                            <FormField
                              control={form.control}
                              name="riskFactors.heightDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">고소작업 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="고소작업에 대한 상세 정보를 입력하세요 (높이, 안전대 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskFactors.mechanical"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="mechanical"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="mechanical" className="text-sm font-medium">
                              기계적 위험
                            </Label>
                          </div>
                          {form.watch("riskFactors.mechanical") && (
                            <FormField
                              control={form.control}
                              name="riskFactors.mechanicalDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">기계적 위험 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="기계적 위험에 대한 상세 정보를 입력하세요 (회전부, 협착 위험 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />
                  </div>
                </div>

                {/* Required Safety Equipment Management */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">필수 안전장비 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentEquipment = form.getValues("requiredSafetyEquipment") || [];
                        form.setValue("requiredSafetyEquipment", [
                          ...currentEquipment,
                          ""
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      장비 추가
                    </Button>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="requiredSafetyEquipment"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-3">
                          {(Array.isArray(field.value) ? field.value : []).map((equipment, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Input
                                placeholder="예: 안전모, 안전화, 안전대"
                                value={equipment}
                                onChange={(e) => {
                                  const newEquipment = [...(Array.isArray(field.value) ? field.value : [])];
                                  newEquipment[index] = e.target.value;
                                  field.onChange(newEquipment);
                                }}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newEquipment = Array.isArray(field.value) ? [...field.value] : [];
                                  newEquipment.splice(index, 1);
                                  field.onChange(newEquipment);
                                }}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {(!field.value || (Array.isArray(field.value) && field.value.length === 0)) && (
                            <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                              안전장비를 추가하려면 "장비 추가" 버튼을 클릭하세요
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Hazardous Chemicals Management */}
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-base font-medium">유해화학물질 정보</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hazardousChemicalType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>화학물질 종류</FormLabel>
                          <FormControl>
                            <Input placeholder="예: 질소, 산소, 아세틸렌" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hazardousChemicalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>화학물질명</FormLabel>
                          <FormControl>
                            <Input placeholder="예: 액체질소" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="msdsImageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MSDS 이미지 URL</FormLabel>
                        <FormControl>
                          <Input placeholder="예: /attached_assets/nitrogen_msds.png" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Safety Facility Locations Management */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">안전시설 위치 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentFacilities = form.getValues("safetyFacilityLocations") || [];
                        form.setValue("safetyFacilityLocations", [
                          ...currentFacilities,
                          { name: "", location: "", type: "FIRE_EXTINGUISHER", imageUrl: "" }
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      시설 추가
                    </Button>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="safetyFacilityLocations"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-4">
                          {(Array.isArray(field.value) ? field.value : []).map((facility: any, index) => (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium">{facility.name || `시설 ${index + 1}`}</h4>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                    facilities.splice(index, 1);
                                    field.onChange(facilities);
                                  }}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">시설명</Label>
                                  <Input
                                    placeholder="예: 소화기, AED"
                                    value={facility.name || ""}
                                    onChange={(e) => {
                                      const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                      facilities[index] = { ...facilities[index], name: e.target.value };
                                      field.onChange(facilities);
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">위치</Label>
                                  <Input
                                    placeholder="예: 1층 입구, 복도 끝"
                                    value={facility.location || ""}
                                    onChange={(e) => {
                                      const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                      facilities[index] = { ...facilities[index], location: e.target.value };
                                      field.onChange(facilities);
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">시설 유형</Label>
                                  <Select
                                    value={facility.type || "FIRE_EXTINGUISHER"}
                                    onValueChange={(value) => {
                                      const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                      facilities[index] = { ...facilities[index], type: value };
                                      field.onChange(facilities);
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="FIRE_EXTINGUISHER">소화기</SelectItem>
                                      <SelectItem value="AED">자동심장충격기</SelectItem>
                                      <SelectItem value="EMERGENCY_EXIT">비상구</SelectItem>
                                      <SelectItem value="FIRST_AID">응급처치함</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">이미지 URL</Label>
                                  <Input
                                    placeholder="시설 위치 이미지 경로"
                                    value={facility.imageUrl || ""}
                                    onChange={(e) => {
                                      const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                      facilities[index] = { ...facilities[index], imageUrl: e.target.value };
                                      field.onChange(facilities);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!field.value || (Array.isArray(field.value) && field.value.length === 0)) && (
                            <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                              안전시설을 추가하려면 "시설 추가" 버튼을 클릭하세요
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Safety Device Location Management */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">안전장치 위치 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentDevices = form.getValues("safetyDeviceImages") || [];
                        form.setValue("safetyDeviceImages", [
                          ...currentDevices,
                          { name: "", location: "", imageUrl: "" }
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      장치 추가
                    </Button>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="safetyDeviceImages"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-4">
                          {(Array.isArray(field.value) ? field.value : []).map((device: any, index) => (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium">{device.name || `안전장치 ${index + 1}`}</h4>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const devices = Array.isArray(field.value) ? [...field.value] : [];
                                    devices.splice(index, 1);
                                    field.onChange(devices);
                                  }}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">장치명</Label>
                                  <Input
                                    placeholder="예: 안전밸브, 압력계"
                                    value={device.name || ""}
                                    onChange={(e) => {
                                      const devices = Array.isArray(field.value) ? [...field.value] : [];
                                      devices[index] = { ...devices[index], name: e.target.value };
                                      field.onChange(devices);
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">위치</Label>
                                  <Input
                                    placeholder="예: 상단, 측면"
                                    value={device.location || ""}
                                    onChange={(e) => {
                                      const devices = Array.isArray(field.value) ? [...field.value] : [];
                                      devices[index] = { ...devices[index], location: e.target.value };
                                      field.onChange(devices);
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">이미지 URL</Label>
                                  <Input
                                    placeholder="장치 위치 이미지 경로"
                                    value={device.imageUrl || ""}
                                    onChange={(e) => {
                                      const devices = Array.isArray(field.value) ? [...field.value] : [];
                                      devices[index] = { ...devices[index], imageUrl: e.target.value };
                                      field.onChange(devices);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!field.value || (Array.isArray(field.value) && field.value.length === 0)) && (
                            <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                              안전장치를 추가하려면 "장치 추가" 버튼을 클릭하세요
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Emergency Contacts Management */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">비상연락처 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentContacts = form.getValues("emergencyContacts") || [];
                        form.setValue("emergencyContacts", [
                          ...currentContacts,
                          { role: "", contact: "" }
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      연락처 추가
                    </Button>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="emergencyContacts"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-4">
                          {(Array.isArray(field.value) ? field.value : []).map((contact: any, index) => (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium">{contact.role || `연락처 ${index + 1}`}</h4>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const contacts = Array.isArray(field.value) ? [...field.value] : [];
                                    contacts.splice(index, 1);
                                    field.onChange(contacts);
                                  }}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">역할/직책</Label>
                                  <Input
                                    placeholder="예: 안전관리자, 설비담당자"
                                    value={contact.role || ""}
                                    onChange={(e) => {
                                      const contacts = Array.isArray(field.value) ? [...field.value] : [];
                                      contacts[index] = { ...contacts[index], role: e.target.value };
                                      field.onChange(contacts);
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">연락처</Label>
                                  <Input
                                    placeholder="예: 010-1234-5678"
                                    value={contact.contact || ""}
                                    onChange={(e) => {
                                      const contacts = Array.isArray(field.value) ? [...field.value] : [];
                                      contacts[index] = { ...contacts[index], contact: e.target.value };
                                      field.onChange(contacts);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!field.value || (Array.isArray(field.value) && field.value.length === 0)) && (
                            <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                              비상연락처를 추가하려면 "연락처 추가" 버튼을 클릭하세요
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Accident History Management */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">사고이력 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewIncidents([...newIncidents, {
                          description: "",
                          severity: "MEDIUM",
                          occurredAt: new Date().toISOString().slice(0, 16),
                          reportedBy: "",
                          actions: ""
                        }]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      사고 추가
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {newIncidents.map((incident, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium">사고 {index + 1}</h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = [...newIncidents];
                              updated.splice(index, 1);
                              setNewIncidents(updated);
                            }}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">심각도</Label>
                            <Select
                              value={incident.severity}
                              onValueChange={(value) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], severity: value as "HIGH" | "MEDIUM" | "LOW" };
                                setNewIncidents(updated);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="HIGH">높음 (HIGH)</SelectItem>
                                <SelectItem value="MEDIUM">보통 (MEDIUM)</SelectItem>
                                <SelectItem value="LOW">낮음 (LOW)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">발생일시</Label>
                            <Input
                              type="datetime-local"
                              value={incident.occurredAt}
                              onChange={(e) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], occurredAt: e.target.value };
                                setNewIncidents(updated);
                              }}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">사고 설명</Label>
                            <Textarea
                              placeholder="사고 내용을 상세히 기술하세요"
                              value={incident.description}
                              onChange={(e) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], description: e.target.value };
                                setNewIncidents(updated);
                              }}
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">보고자</Label>
                            <Input
                              placeholder="보고자 이름"
                              value={incident.reportedBy}
                              onChange={(e) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], reportedBy: e.target.value };
                                setNewIncidents(updated);
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">조치사항</Label>
                            <Textarea
                              placeholder="취한 조치사항을 기술하세요"
                              value={incident.actions}
                              onChange={(e) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], actions: e.target.value };
                                setNewIncidents(updated);
                              }}
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {newIncidents.length === 0 && (
                      <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                        사고이력을 추가하려면 "사고 추가" 버튼을 클릭하세요
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                    취소
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-primary hover:bg-primary/90"
                    disabled={createEquipmentMutation.isPending}
                  >
                    {createEquipmentMutation.isPending ? "추가 중..." : "추가"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Equipment Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>설비 편집</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설비명</FormLabel>
                        <FormControl>
                          <Input placeholder="예: 압축기" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설비코드</FormLabel>
                        <FormControl>
                          <Input placeholder="예: A-101" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>위치</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 1층 생산라인" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={editForm.control}
                    name="installYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설치년도</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="예: 2020" 
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>제조사</FormLabel>
                        <FormControl>
                          <Input placeholder="예: 한국산업" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="modelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>모델명</FormLabel>
                        <FormControl>
                          <Input placeholder="예: KIC-500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>설비 이미지 URL</FormLabel>
                      <FormControl>
                        <Input placeholder="예: /attached_assets/compressor.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="riskLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        위험도 등급
                        <Badge variant="outline" className="text-xs">AI 자동 설정</Badge>
                      </FormLabel>
                      <FormControl>
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">AI가 평가한 위험도:</span>
                            <RiskLevelBadge level={field.value || "MEDIUM"} />
                          </div>
                        </div>
                      </FormControl>
                      <div className="text-xs text-gray-500 mt-1">
                        설비 정보 변경 시 AI가 자동으로 위험도를 재평가합니다
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Risk Factors */}
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-base font-medium">위험요소</Label>
                  
                  <div className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="riskFactors.highVoltage"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="editHighVoltage"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="editHighVoltage" className="text-sm font-medium">
                              고전압
                            </Label>
                          </div>
                          {editForm.watch("riskFactors.highVoltage") && (
                            <FormField
                              control={editForm.control}
                              name="riskFactors.highVoltageDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">고전압 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="고전압에 대한 상세 정보를 입력하세요 (전압 수준, 안전 조치 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="riskFactors.highPressure"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="editHighPressure"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="editHighPressure" className="text-sm font-medium">
                              고압
                            </Label>
                          </div>
                          {editForm.watch("riskFactors.highPressure") && (
                            <FormField
                              control={editForm.control}
                              name="riskFactors.highPressureDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">고압 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="고압에 대한 상세 정보를 입력하세요 (압력 수준, 안전 밸브 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="riskFactors.highTemperature"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="editHighTemperature"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="editHighTemperature" className="text-sm font-medium">
                              고온
                            </Label>
                          </div>
                          {editForm.watch("riskFactors.highTemperature") && (
                            <FormField
                              control={editForm.control}
                              name="riskFactors.highTemperatureDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">고온 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="고온에 대한 상세 정보를 입력하세요 (온도 범위, 보호 장비 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="riskFactors.height"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="editHeight"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="editHeight" className="text-sm font-medium">
                              고소작업
                            </Label>
                          </div>
                          {editForm.watch("riskFactors.height") && (
                            <FormField
                              control={editForm.control}
                              name="riskFactors.heightDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">고소작업 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="고소작업에 대한 상세 정보를 입력하세요 (높이, 안전대 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="riskFactors.mechanical"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="editMechanical"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <Label htmlFor="editMechanical" className="text-sm font-medium">
                              기계적 위험
                            </Label>
                          </div>
                          {editForm.watch("riskFactors.mechanical") && (
                            <FormField
                              control={editForm.control}
                              name="riskFactors.mechanicalDetail"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel className="text-xs text-muted-foreground">기계적 위험 상세 정보</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="기계적 위험에 대한 상세 정보를 입력하세요 (회전부, 협착 위험 등)"
                                      {...field}
                                      rows={2}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    />
                  </div>
                </div>

                {/* Required Safety Equipment Management */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">필수 안전장비 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentEquipment = editForm.getValues("requiredSafetyEquipment") || [];
                        editForm.setValue("requiredSafetyEquipment", [
                          ...currentEquipment,
                          ""
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      장비 추가
                    </Button>
                  </div>
                  
                  <FormField
                    control={editForm.control}
                    name="requiredSafetyEquipment"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-3">
                          {(Array.isArray(field.value) ? field.value : []).map((equipment, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Input
                                placeholder="예: 안전모, 안전화, 안전대"
                                value={equipment}
                                onChange={(e) => {
                                  const newEquipment = [...(Array.isArray(field.value) ? field.value : [])];
                                  newEquipment[index] = e.target.value;
                                  field.onChange(newEquipment);
                                }}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newEquipment = Array.isArray(field.value) ? [...field.value] : [];
                                  newEquipment.splice(index, 1);
                                  field.onChange(newEquipment);
                                }}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {(!field.value || (Array.isArray(field.value) && field.value.length === 0)) && (
                            <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                              안전장비를 추가하려면 "장비 추가" 버튼을 클릭하세요
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Hazardous Chemicals Management */}
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-base font-medium">유해화학물질 정보</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="hazardousChemicalType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>화학물질 종류</FormLabel>
                          <FormControl>
                            <Input placeholder="예: 질소, 산소, 아세틸렌" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="hazardousChemicalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>화학물질명</FormLabel>
                          <FormControl>
                            <Input placeholder="예: 액체질소" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="msdsImageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MSDS 이미지 URL</FormLabel>
                        <FormControl>
                          <Input placeholder="예: /attached_assets/nitrogen_msds.png" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Safety Device Location Management */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">안전장치 위치 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentDevices = editForm.getValues("safetyDeviceImages") || [];
                        editForm.setValue("safetyDeviceImages", [
                          ...currentDevices,
                          { name: "", location: "", imageUrl: "" }
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      장치 추가
                    </Button>
                  </div>
                  
                  <FormField
                    control={editForm.control}
                    name="safetyDeviceImages"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-4">
                          {(Array.isArray(field.value) ? field.value : []).map((facility: any, index) => (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium">{facility.name || `시설 ${index + 1}`}</h4>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                    facilities.splice(index, 1);
                                    field.onChange(facilities);
                                  }}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">시설명</Label>
                                  <Input
                                    placeholder="예: 소화기, AED"
                                    value={facility.name || ""}
                                    onChange={(e) => {
                                      const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                      facilities[index] = { ...facilities[index], name: e.target.value };
                                      field.onChange(facilities);
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">위치</Label>
                                  <Input
                                    placeholder="예: 1층 입구, 복도 끝"
                                    value={facility.location || ""}
                                    onChange={(e) => {
                                      const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                      facilities[index] = { ...facilities[index], location: e.target.value };
                                      field.onChange(facilities);
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">시설 유형</Label>
                                  <Select
                                    value={facility.type || "FIRE_EXTINGUISHER"}
                                    onValueChange={(value) => {
                                      const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                      facilities[index] = { ...facilities[index], type: value };
                                      field.onChange(facilities);
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="FIRE_EXTINGUISHER">소화기</SelectItem>
                                      <SelectItem value="AED">자동심장충격기</SelectItem>
                                      <SelectItem value="EMERGENCY_EXIT">비상구</SelectItem>
                                      <SelectItem value="FIRST_AID">응급처치함</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">이미지 URL</Label>
                                  <Input
                                    placeholder="시설 위치 이미지 경로"
                                    value={facility.imageUrl || ""}
                                    onChange={(e) => {
                                      const facilities = Array.isArray(field.value) ? [...field.value] : [];
                                      facilities[index] = { ...facilities[index], imageUrl: e.target.value };
                                      field.onChange(facilities);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!field.value || (Array.isArray(field.value) && field.value.length === 0)) && (
                            <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                              안전시설을 추가하려면 "시설 추가" 버튼을 클릭하세요
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Emergency Contact Management */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">비상연락처 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentContacts = editForm.getValues("emergencyContacts") || [];
                        editForm.setValue("emergencyContacts", [
                          ...currentContacts,
                          { name: "", role: "", phone: "" }
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      연락처 추가
                    </Button>
                  </div>
                  
                  <FormField
                    control={editForm.control}
                    name="emergencyContacts"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-4">
                          {(Array.isArray(field.value) ? field.value : []).map((contact: any, index) => (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium">{contact.role || `연락처 ${index + 1}`}</h4>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const contacts = Array.isArray(field.value) ? [...field.value] : [];
                                    contacts.splice(index, 1);
                                    field.onChange(contacts);
                                  }}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">역할/직책</Label>
                                  <Input
                                    placeholder="예: 안전관리자, 설비담당자"
                                    value={contact.role || ""}
                                    onChange={(e) => {
                                      const contacts = Array.isArray(field.value) ? [...field.value] : [];
                                      contacts[index] = { ...contacts[index], role: e.target.value };
                                      field.onChange(contacts);
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">연락처</Label>
                                  <Input
                                    placeholder="예: 010-1234-5678"
                                    value={contact.contact || ""}
                                    onChange={(e) => {
                                      const contacts = Array.isArray(field.value) ? [...field.value] : [];
                                      contacts[index] = { ...contacts[index], contact: e.target.value };
                                      field.onChange(contacts);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!field.value || (Array.isArray(field.value) && field.value.length === 0)) && (
                            <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                              비상연락처를 추가하려면 "연락처 추가" 버튼을 클릭하세요
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Accident History Management - Edit Dialog */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">사고이력 관리</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewIncidents([...newIncidents, {
                          description: "",
                          severity: "MEDIUM",
                          occurredAt: new Date().toISOString().slice(0, 16),
                          reportedBy: "",
                          actions: ""
                        }]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      사고 추가
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {newIncidents.map((incident, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium">사고 {index + 1}</h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = [...newIncidents];
                              updated.splice(index, 1);
                              setNewIncidents(updated);
                            }}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">심각도</Label>
                            <Select
                              value={incident.severity}
                              onValueChange={(value) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], severity: value as "HIGH" | "MEDIUM" | "LOW" };
                                setNewIncidents(updated);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="HIGH">높음 (HIGH)</SelectItem>
                                <SelectItem value="MEDIUM">보통 (MEDIUM)</SelectItem>
                                <SelectItem value="LOW">낮음 (LOW)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">발생일시</Label>
                            <Input
                              type="datetime-local"
                              value={incident.occurredAt}
                              onChange={(e) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], occurredAt: e.target.value };
                                setNewIncidents(updated);
                              }}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">사고 설명</Label>
                            <Textarea
                              placeholder="사고 내용을 상세히 기술하세요"
                              value={incident.description}
                              onChange={(e) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], description: e.target.value };
                                setNewIncidents(updated);
                              }}
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">보고자</Label>
                            <Input
                              placeholder="보고자 이름"
                              value={incident.reportedBy}
                              onChange={(e) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], reportedBy: e.target.value };
                                setNewIncidents(updated);
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">조치사항</Label>
                            <Textarea
                              placeholder="취한 조치사항을 기술하세요"
                              value={incident.actions}
                              onChange={(e) => {
                                const updated = [...newIncidents];
                                updated[index] = { ...updated[index], actions: e.target.value };
                                setNewIncidents(updated);
                              }}
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {newIncidents.length === 0 && (
                      <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                        사고이력을 추가하려면 "사고 추가" 버튼을 클릭하세요
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                    취소
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-primary hover:bg-primary/90"
                    disabled={updateEquipmentMutation.isPending}
                  >
                    {updateEquipmentMutation.isPending ? "수정 중..." : "수정"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="card-minimal card-hover">
          <div className="p-4 text-center">
            <Factory className="h-8 w-8 text-gray-700 mx-auto mb-2" />
            <p className="text-heading-2 text-gray-900 mb-1">{riskCounts.total}</p>
            <p className="text-caption text-gray-600">총 설비</p>
          </div>
        </div>
        <div className="card-minimal card-hover">
          <div className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-heading-2 text-gray-900 mb-1">{riskCounts.high}</p>
            <p className="text-caption text-gray-600">고위험</p>
          </div>
        </div>
        <div className="card-minimal card-hover">
          <div className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-heading-2 text-gray-900 mb-1">{riskCounts.medium}</p>
            <p className="text-caption text-gray-600">중위험</p>
          </div>
        </div>
        <div className="card-minimal card-hover">
          <div className="p-4 text-center">
            <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-heading-2 text-gray-900 mb-1">{riskCounts.low}</p>
            <p className="text-caption text-gray-600">저위험</p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card-minimal mb-4">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="설비명, 코드, 위치로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
              />
            </div>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-full md:w-48 border-gray-200">
                <SelectValue placeholder="위험도 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="HIGH">HIGH (고위험)</SelectItem>
                <SelectItem value="MEDIUM">MEDIUM (중위험)</SelectItem>
                <SelectItem value="LOW">LOW (저위험)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Equipment List */}
      <div className="grid gap-3">
        {filteredEquipment?.map((eq) => (
          <div key={eq.id} className="card-minimal card-hover">
            <div className="p-4">
              <div className="space-y-2">
                {/* 첫 번째 줄: 설비명, 설비코드, 안전등급 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-heading-3 text-gray-900">{eq.name}</h3>
                    <span className="text-body text-gray-600">{eq.code}</span>
                    <RiskLevelBadge level={eq.riskLevel} />
                  </div>
                </div>
                
                {/* 두 번째 줄: 버튼들 */}
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/work-management/${eq.id}`)}
                    className="btn-minimal-secondary"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    작업관리
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditEquipment(eq)}
                    className="btn-minimal-secondary"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    편집
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteEquipment(eq)}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
                    disabled={deleteEquipmentMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!filteredEquipment?.length && (
        <Card>
          <CardContent className="p-8 text-center">
            <Factory className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">등록된 설비가 없습니다.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}