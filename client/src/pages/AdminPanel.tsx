import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useEquipment } from "@/hooks/useEquipment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEquipmentSchema, type InsertEquipment } from "@shared/schema";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import RiskLevelBadge from "@/components/RiskLevelBadge";
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Edit, 
  Settings,
  Factory,
  Shield,
  AlertTriangle
} from "lucide-react";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  const { data: equipment, isLoading } = useEquipment();

  const form = useForm<InsertEquipment>({
    resolver: zodResolver(insertEquipmentSchema),
    defaultValues: {
      name: "",
      code: "",
      location: "",
      manufacturer: "",
      installYear: new Date().getFullYear(),
      specification: "",
      imageUrl: "",
      modelName: "",
      riskLevel: "GREEN",
      highVoltageRisk: false,
      highPressureRisk: false,
      highTemperatureRisk: false,
      heightRisk: false,
      heavyWeightRisk: false,
      requiredSafetyEquipment: [],
      lotoPoints: [],
      safetyFacilityLocations: [],
      emergencyContacts: [],
      safetyDeviceImages: []
    }
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async (data: InsertEquipment) => {
      const response = await apiRequest("POST", "/api/equipment", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "설비 생성 완료",
        description: "새로운 설비가 성공적으로 추가되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setShowAddDialog(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "설비 생성 실패",
        description: "설비를 생성하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: InsertEquipment) => {
    createEquipmentMutation.mutate(data);
  };

  const filteredEquipment = equipment?.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterRisk === "all" || eq.riskLevel === filterRisk;
    
    return matchesSearch && matchesFilter;
  }) || [];

  const riskCounts = {
    total: equipment?.length || 0,
    red: equipment?.filter(eq => eq.riskLevel === "RED").length || 0,
    yellow: equipment?.filter(eq => eq.riskLevel === "YELLOW").length || 0,
    green: equipment?.filter(eq => eq.riskLevel === "GREEN").length || 0,
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">설비 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-medium">설비 관리</h2>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white">
              <Plus className="mr-1 h-4 w-4" />
              설비 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                          <Input placeholder="설비명을 입력하세요" {...field} />
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
                        <FormLabel>설비 코드</FormLabel>
                        <FormControl>
                          <Input placeholder="예: COMP-A-101" {...field} />
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
                      <FormLabel>설치 위치</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 1공장 동쪽 구역" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>제조사</FormLabel>
                        <FormControl>
                          <Input placeholder="제조사명" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="installYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설치년도</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="2024" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="modelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>모델명</FormLabel>
                        <FormControl>
                          <Input placeholder="예: SC-500-15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>설비 사진 URL</FormLabel>
                        <FormControl>
                          <Input placeholder="설비 사진 URL을 입력하세요" {...field} />
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
                            <SelectItem value="GREEN">안전 (GREEN)</SelectItem>
                            <SelectItem value="YELLOW">주의 (YELLOW)</SelectItem>
                            <SelectItem value="RED">위험 (RED)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>위험 요소</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="highVoltageRisk"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm">고전압</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="highPressureRisk"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm">고압가스</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="highTemperatureRisk"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm">고온</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="heightRisk"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm">고소</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="heavyWeightRisk"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm">고중량</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="specification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>규격/사양</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="예: 용량: 500L/min, 압력: 15bar, 전력: 75kW" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowAddDialog(false)}
                  >
                    취소
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={createEquipmentMutation.isPending}
                  >
                    {createEquipmentMutation.isPending ? "생성 중..." : "생성"}
                  </Button>
                </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Factory className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{riskCounts.total}</p>
            <p className="text-xs text-gray-600">총 설비</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-danger mx-auto mb-2" />
            <p className="text-2xl font-bold text-danger">{riskCounts.red}</p>
            <p className="text-xs text-gray-600">고위험</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold text-warning">{riskCounts.yellow}</p>
            <p className="text-xs text-gray-600">주의</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold text-success">{riskCounts.green}</p>
            <p className="text-xs text-gray-600">안전</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="material-shadow mb-6">
        <CardContent className="p-4">
          <div className="flex space-x-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="설비명 또는 코드 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex space-x-2">
            <Button
              variant={filterRisk === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRisk("all")}
              className={filterRisk === "all" ? "bg-primary text-white" : ""}
            >
              전체
            </Button>
            <Button
              variant={filterRisk === "RED" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRisk("RED")}
              className={filterRisk === "RED" ? "bg-danger text-white" : ""}
            >
              고위험
            </Button>
            <Button
              variant={filterRisk === "YELLOW" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRisk("YELLOW")}
              className={filterRisk === "YELLOW" ? "bg-warning text-white" : ""}
            >
              주의
            </Button>
            <Button
              variant={filterRisk === "GREEN" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRisk("GREEN")}
              className={filterRisk === "GREEN" ? "bg-success text-white" : ""}
            >
              안전
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Equipment List */}
      <div className="space-y-4">
        {filteredEquipment.map((eq) => (
          <Card key={eq.id} className="material-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">{eq.name}</h3>
                  <p className="text-sm text-gray-600 mb-1">{eq.code}</p>
                  <p className="text-sm text-gray-600 mb-2">{eq.location}</p>
                  <RiskLevelBadge level={eq.riskLevel} />
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-sm">
                  <span className="text-gray-600">제조사:</span>
                  <span className="ml-1">{eq.manufacturer || "미입력"}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">설치년도:</span>
                  <span className="ml-1">{eq.installYear || "미입력"}</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 text-sm mb-4">
                {eq.highTemperatureRisk && (
                  <span className="flex items-center text-danger">
                    <span className="material-icons text-sm mr-1">whatshot</span>
                    고온
                  </span>
                )}
                {eq.highPressureRisk && (
                  <span className="flex items-center text-warning">
                    <span className="material-icons text-sm mr-1">compress</span>
                    고압
                  </span>
                )}
                {eq.highVoltageRisk && (
                  <span className="flex items-center text-danger">
                    <span className="material-icons text-sm mr-1">flash_on</span>
                    고전압
                  </span>
                )}
                {eq.heavyWeightRisk && (
                  <span className="flex items-center text-warning">
                    <span className="material-icons text-sm mr-1">fitness_center</span>
                    고중량
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setLocation(`/equipment/${eq.id}`)}
                >
                  <Edit className="mr-1 h-3 w-3" />
                  편집
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setLocation(`/equipment/${eq.id}/work-types`)}
                >
                  <Settings className="mr-1 h-3 w-3" />
                  작업 관리
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredEquipment.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">검색 결과가 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
