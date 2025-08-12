import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Eye, Shield, BookOpen, AlertTriangle, Clock, MapPin, Thermometer, Wind, Droplets, Plus, Edit, Trash2, User, CheckCircle, Wrench, HardHat, ScrollText, History, GraduationCap, Zap } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { WorkScheduleForm } from "@/components/WorkScheduleForm";

interface WorkSchedule {
  id: number;
  equipmentId: number;
  workTypeId: number;
  scheduledDate: string;
  briefingTime: string;
  workerName: string;
  workLocation?: string;
  specialNotes: string;
  status: string;
  createdAt: string;
  equipmentName?: string;
  equipmentCode?: string;
  workTypeName?: string;
}

interface SafetyBriefingData {
  briefing: any;
  weatherInfo: {
    location: string;
    temperature: number;
    humidity: number;
    windSpeed: number;
    condition: string;
    description: string;
    safetyWarnings: string[];
  };
  workSummary: string;
  riskFactors: string[];
  riskAssessment: any;
  requiredTools: Array<{name: string; source: string}> | string[];
  requiredSafetyEquipment: Array<{name: string; source: string}> | string[];
  weatherConsiderations: string[];
  safetyRecommendations: string[];
  regulations: any[];
  relatedIncidents: any[]; // RAG 검색된 유사 사고사례
  registeredIncidents: any[]; // 설비별 등록된 사고이력
  educationMaterials: any[];
  quizQuestions: any[];
  safetySlogan: string;
}

export default function Briefing() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWorkSchedule, setSelectedWorkSchedule] = useState<WorkSchedule | null>(null);
  const [briefingData, setBriefingData] = useState<SafetyBriefingData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{[key: number]: number}>({});
  const queryClient = useQueryClient();

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  // Fetch work schedules for selected date
  const { data: workSchedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['/api/work-schedules', dateString],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/work-schedules?date=${dateString}`);
      return response.json();
    },
  });

  // Generate safety briefing mutation
  const generateBriefingMutation = useMutation({
    mutationFn: async (workScheduleId: number) => {
      const response = await apiRequest('POST', `/api/generate-safety-briefing/${workScheduleId}`);
      return response.json();
    },
    onSuccess: (data) => {
      setBriefingData(data);
      setQuizAnswers({}); // Reset quiz answers for new briefing
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error('브리핑 생성 오류:', error);
      setIsGenerating(false);
    }
  });

  // Delete work schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const response = await apiRequest('DELETE', `/api/work-schedules/${scheduleId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-schedules'] });
    },
    onError: (error) => {
      console.error('작업 일정 삭제 오류:', error);
    }
  });

  const handleGenerateBriefing = async (workSchedule: WorkSchedule) => {
    setSelectedWorkSchedule(workSchedule);
    setIsGenerating(true);
    generateBriefingMutation.mutate(workSchedule.id);
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (confirm('이 작업 일정을 삭제하시겠습니까?')) {
      deleteScheduleMutation.mutate(scheduleId);
    }
  };

  const handleQuizAnswer = (quizIndex: number, selectedOption: number) => {
    setQuizAnswers(prev => ({
      ...prev,
      [quizIndex]: selectedOption
    }));
  };

  const getRiskLevelColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              AI 기반 안전 브리핑 시스템
            </h1>
            <p className="text-gray-600 mb-6">
              일일 작업 안전 브리핑을 AI 기술로 자동 생성하고 관리합니다
            </p>
            <WorkScheduleForm 
              trigger={
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  작업 일정 등록
                </Button>
              }
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/work-schedules'] })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Date Selection Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  날짜 선택
                </CardTitle>
                <CardDescription>
                  브리핑을 확인할 작업 날짜를 선택하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ko}
                  className="w-full"
                  classNames={{
                    months: "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "space-y-4 w-full",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-sm font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse",
                    head_row: "flex w-full",
                    head_cell: "text-muted-foreground rounded-md font-normal text-[0.8rem] flex-1 text-center py-2",
                    row: "flex w-full mt-1",
                    cell: "text-center text-sm p-0 relative flex-1 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-8 sm:h-10 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground text-center flex items-center justify-center rounded-md",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground font-semibold",
                    day_outside: "text-muted-foreground opacity-50",
                    day_disabled: "text-muted-foreground opacity-50",
                    day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                    day_hidden: "invisible",
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Work Schedules Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {format(selectedDate, 'PPP', { locale: ko })} 작업 일정
                </CardTitle>
                <CardDescription>
                  선택한 날짜의 작업 목록과 안전 브리핑
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schedulesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : workSchedules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    선택한 날짜에 등록된 작업이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workSchedules.map((schedule: WorkSchedule) => (
                      <div key={schedule.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">
                                {schedule.equipmentName && schedule.workTypeName 
                                  ? `${schedule.equipmentName} - ${schedule.workTypeName}`
                                  : '작업 설명 없음'
                                }
                              </h3>
                              <Badge variant={schedule.status === 'scheduled' ? 'default' : 'secondary'}>
                                {schedule.status === 'scheduled' ? '예정' : schedule.status}
                              </Badge>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm text-gray-600 gap-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {schedule.briefingTime || '시간 미지정'}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                작업자: {schedule.workerName}
                              </span>
                            </div>
                            {schedule.specialNotes && (
                              <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                                <span className="font-medium text-yellow-800">특이사항:</span> 
                                <span className="text-yellow-700 ml-1">{schedule.specialNotes}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              onClick={() => handleGenerateBriefing(schedule)}
                              disabled={isGenerating}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              AI 안전브리핑
                            </Button>
                            <div className="flex gap-2">
                              <WorkScheduleForm 
                                trigger={
                                  <Button variant="outline" size="sm">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                }
                                editData={schedule}
                                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/work-schedules'] })}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSchedule(schedule.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Safety Briefing Dialog */}
        {briefingData && (
          <Dialog open={!!briefingData} onOpenChange={() => setBriefingData(null)}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="flex items-center gap-2 text-2xl mb-3">
                  <Shield className="w-7 h-7 text-blue-600" />
                  AI 안전 브리핑
                </DialogTitle>
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg">
                  <h2 className="text-xl font-bold text-center">
                    {selectedWorkSchedule?.equipmentName} - {selectedWorkSchedule?.workTypeName}
                  </h2>
                  <p className="text-center text-blue-100 mt-1 text-sm">
                    {selectedWorkSchedule?.scheduledDate && format(new Date(selectedWorkSchedule.scheduledDate), 'yyyy년 MM월 dd일 (E)', { locale: ko })}
                  </p>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Today's Safety Slogan */}
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <h3 className="font-bold text-lg text-blue-800 mb-2">오늘의 안전구호</h3>
                      <p className="text-blue-700 text-lg font-medium">{briefingData.safetySlogan}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Weather Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Thermometer className="w-5 h-5" />
                      날씨 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {briefingData.weatherInfo ? (
                      <>
                        <div className="text-sm text-gray-600 mb-3">위치: {briefingData.weatherInfo.location}</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{briefingData.weatherInfo.temperature}°C</div>
                            <div className="text-sm text-gray-600">기온</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold flex items-center justify-center">
                              <Droplets className="w-5 h-5 mr-1" />
                              {briefingData.weatherInfo.humidity}%
                            </div>
                            <div className="text-sm text-gray-600">습도</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold flex items-center justify-center">
                              <Wind className="w-5 h-5 mr-1" />
                              {briefingData.weatherInfo.windSpeed}m/s
                            </div>
                            <div className="text-sm text-gray-600">풍속</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{briefingData.weatherInfo.condition}</div>
                            <div className="text-sm text-gray-600">날씨</div>
                          </div>
                        </div>
                        
                        {briefingData.weatherInfo.safetyWarnings && briefingData.weatherInfo.safetyWarnings.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <h4 className="font-semibold text-yellow-800 mb-2">날씨 안전 경고</h4>
                            <ul className="space-y-1">
                              {briefingData.weatherInfo.safetyWarnings.map((warning, index) => (
                                <li key={index} className="text-yellow-700 text-sm">• {warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <div className="text-red-600 font-medium mb-2">실시간 날씨 정보 연결 실패</div>
                        <div className="text-red-500 text-sm">
                          날씨 API 연결에 실패했습니다. 현장에서 직접 날씨 상황을 확인하고 
                          작업 전 안전 점검을 철저히 수행하세요.
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Work Summary and Risk Assessment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Wrench className="w-5 h-5" />
                        작업 내용 요약
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-gray-700">{briefingData.workSummary}</p>
                      
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">주요 위험 요인</h4>
                        <ul className="space-y-1">
                          {briefingData.riskFactors.map((factor, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                              <span className="text-sm">{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Shield className="w-5 h-5" />
                        위험성 평가 결과
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">종합 위험도</span>
                          <Badge className={getRiskLevelColor(briefingData.riskAssessment.overallRiskLevel)}>
                            {briefingData.riskAssessment.overallRiskLevel}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          총점: {briefingData.riskAssessment.totalScore}점
                        </div>
                      </div>

                      <div className="space-y-2">
                        {briefingData.riskAssessment.riskFactors?.map((risk: any, index: number) => (
                          <div key={index} className="border-l-4 border-orange-400 pl-3 py-1">
                            <div className="font-medium text-sm">{risk.factor}</div>
                            <div className="text-xs text-gray-600">
                              위험점수: {risk.score}점 (가능성:{risk.probability} × 심각도:{risk.severity})
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Required Tools and Safety Equipment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Wrench className="w-5 h-5" />
                        필요한 작업도구
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {briefingData.requiredTools.map((tool, index) => {
                          const toolItem = typeof tool === 'string' ? { name: tool, source: 'registered' } : tool;
                          return (
                            <li key={index} className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span>{toolItem.name}</span>
                              {toolItem.source === 'ai_recommended' && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                  AI추천
                                </Badge>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <HardHat className="w-5 h-5" />
                        필요한 안전장비
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {briefingData.requiredSafetyEquipment.map((equipment, index) => {
                          const equipmentItem = typeof equipment === 'string' ? { name: equipment, source: 'registered' } : equipment;
                          return (
                            <li key={index} className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-green-500" />
                              <span>{equipmentItem.name}</span>
                              {equipmentItem.source === 'ai_recommended' && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                  AI추천
                                </Badge>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Safety Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle className="w-5 h-5" />
                      안전 권고사항
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {briefingData.safetyRecommendations.map((recommendation, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <span className="text-green-800 text-sm leading-relaxed">{recommendation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Related Information Tabs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ScrollText className="w-5 h-5" />
                        관련 법령 및 규정
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {briefingData.regulations && briefingData.regulations.length > 0 ? (
                          briefingData.regulations.map((reg: any, index) => (
                            <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="mb-3">
                                <div className="font-bold text-blue-900 text-base mb-1">
                                  {reg.lawName || '산업안전보건기준에 관한 규칙'}
                                </div>
                                <div className="font-semibold text-blue-800">
                                  {reg.articleNumber}{reg.articleTitle ? `(${reg.articleTitle})` : ''}
                                </div>
                              </div>
                              <div className="text-blue-700 text-sm leading-relaxed bg-white p-3 rounded border border-blue-100">
                                {reg.summary || reg.content}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 italic p-3 text-center bg-gray-50 rounded">
                            현재 작업에 해당하는 특별 규정이 검색되지 않았습니다.<br/>
                            기본 산업안전보건법을 준수하세요.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <History className="w-5 h-5" />
                        관련 사고이력
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {briefingData.registeredIncidents && briefingData.registeredIncidents.length > 0 ? (
                          briefingData.registeredIncidents.map((incident: any, index: number) => (
                            <div key={index} className="text-sm p-3 bg-red-50 rounded border border-red-200">
                              <div className="font-medium text-red-800">{incident.title}</div>
                              <div className="text-red-600 mt-1 text-xs">위험도: {incident.severity}</div>
                              {incident.description && (
                                <div className="text-gray-600 mt-2 text-xs leading-relaxed">{incident.description}</div>
                              )}
                              {incident.correctiveActions && (
                                <div className="text-blue-700 mt-2 text-xs font-medium">
                                  조치사항: {incident.correctiveActions}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 italic p-3 text-center bg-gray-50 rounded">
                            해당 설비에 등록된 사고이력이 없습니다.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <GraduationCap className="w-5 h-5" />
                        교육자료
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {briefingData.educationMaterials && briefingData.educationMaterials.length > 0 ? (
                          briefingData.educationMaterials.map((material: any, index) => (
                            <div key={index} className="text-sm p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="font-medium text-blue-800">
                                {material.url ? (
                                  <a 
                                    href={material.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="hover:underline text-blue-800 hover:text-blue-900"
                                  >
                                    {material.title} ↗
                                  </a>
                                ) : (
                                  material.title
                                )}
                              </div>
                              <div className="text-blue-600 mt-1 text-xs">{material.type}</div>
                              {material.content && (
                                <div className="text-gray-700 mt-2 text-xs leading-relaxed bg-white p-2 rounded border">
                                  {material.content.length > 200 ? `${material.content.substring(0, 200)}...` : material.content}
                                </div>
                              )}
                              {material.keywords && (
                                <div className="text-gray-600 mt-2 text-xs">키워드: {material.keywords}</div>
                              )}
                              {material.date && (
                                <div className="text-gray-500 mt-1 text-xs">발행일: {material.date}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 italic p-3 text-center bg-gray-50 rounded">
                            현재 작업과 관련된 특별 교육자료가<br/>
                            검색되지 않았습니다.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* RAG-Based Related Accident Cases */}
                {briefingData.relatedIncidents && briefingData.relatedIncidents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Zap className="w-5 h-5" />
                        유사 사고사례
                      </CardTitle>
                      <CardDescription>
                        AI가 분석한 현재 작업과 유사한 실제 사고사례입니다
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {briefingData.relatedIncidents.map((accident: any, index: number) => (
                          <div key={index} className="border border-orange-200 rounded-lg p-5 bg-white shadow-sm">
                            {/* Header with title and severity badge */}
                            <div className="flex items-start justify-between mb-4">
                              <h4 className="text-lg font-bold text-gray-900 leading-tight">{accident.title}</h4>
                              <Badge className="bg-red-100 text-red-800 border-red-200 font-semibold">
                                HIGH
                              </Badge>
                            </div>
                            
                            {/* Basic information - moved out of gray box */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              {accident.date && (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-700 mb-1">날짜</span>
                                  <span className="text-sm text-gray-900">{accident.date}</span>
                                </div>
                              )}
                              {accident.location && (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-700 mb-1">장소</span>
                                  <span className="text-sm text-gray-900">{accident.location}</span>
                                </div>
                              )}
                              {accident.damage && (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-700 mb-1">피해규모</span>
                                  <span className="text-sm font-semibold text-red-600">{accident.damage}</span>
                                </div>
                              )}
                            </div>

                            {/* Additional details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              {accident.work_type && (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-700 mb-1">작업유형</span>
                                  <span className="text-sm text-gray-900">{accident.work_type}</span>
                                </div>
                              )}
                              {accident.accident_type && (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-700 mb-1">사고형태</span>
                                  <span className="text-sm text-gray-900">{accident.accident_type}</span>
                                </div>
                              )}
                            </div>

                            {/* Summary */}
                            {accident.summary && (
                              <div className="mb-4">
                                <span className="text-sm font-medium text-gray-700 block mb-2">사고개요</span>
                                <p className="text-sm text-gray-900 leading-relaxed">{accident.summary}</p>
                              </div>
                            )}

                            {/* Causes and prevention in colored boxes */}
                            <div className="space-y-3">
                              {accident.direct_cause && (
                                <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                                  <span className="text-sm font-semibold text-red-800 block mb-2">직접원인</span>
                                  <p className="text-sm text-red-700 leading-relaxed">{accident.direct_cause}</p>
                                </div>
                              )}
                              
                              {accident.root_cause && (
                                <div className="p-4 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                                  <span className="text-sm font-semibold text-orange-800 block mb-2">근본원인</span>
                                  <p className="text-sm text-orange-700 leading-relaxed">{accident.root_cause}</p>
                                </div>
                              )}
                              
                              {accident.prevention && (
                                <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                                  <span className="text-sm font-semibold text-blue-800 block mb-2">예방대책</span>
                                  <p className="text-sm text-blue-700 leading-relaxed">{accident.prevention}</p>
                                </div>
                              )}
                            </div>

                            {/* Risk keywords */}
                            {accident.risk_keywords && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <span className="text-sm font-medium text-gray-700 block mb-2">위험키워드</span>
                                <div className="flex flex-wrap gap-2">
                                  {accident.risk_keywords.split(',').map((keyword: string, kidx: number) => (
                                    <span key={kidx} className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                                      {keyword.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Safety Quiz Section */}
                {briefingData.quizQuestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <BookOpen className="w-5 h-5" />
                        안전 이해도 확인 퀴즈
                      </CardTitle>
                      <CardDescription>
                        선택지를 클릭하여 정답을 확인하고 해설을 읽어보세요
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {briefingData.quizQuestions.map((quiz: any, quizIndex) => {
                          const userAnswer = quizAnswers[quizIndex];
                          const hasAnswered = userAnswer !== undefined;
                          
                          return (
                            <div key={quizIndex} className="border rounded-lg p-4">
                              <h4 className="font-medium mb-4">Q{quizIndex + 1}. {quiz.question}</h4>
                              <div className="space-y-2 mb-4">
                                {quiz.options.map((option: string, optIndex: number) => {
                                  const isCorrect = optIndex === quiz.correctAnswer;
                                  const isSelected = userAnswer === optIndex;
                                  
                                  let buttonClass = "w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ";
                                  
                                  if (!hasAnswered) {
                                    buttonClass += "border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer";
                                  } else if (isCorrect) {
                                    buttonClass += "border-green-500 bg-green-50 text-green-800";
                                  } else if (isSelected && !isCorrect) {
                                    buttonClass += "border-red-500 bg-red-50 text-red-800";
                                  } else {
                                    buttonClass += "border-gray-200 text-gray-600";
                                  }
                                  
                                  return (
                                    <button
                                      key={optIndex}
                                      onClick={() => !hasAnswered && handleQuizAnswer(quizIndex, optIndex)}
                                      disabled={hasAnswered}
                                      className={buttonClass}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                                          hasAnswered && isCorrect
                                            ? 'bg-green-100 border-green-500 text-green-700'
                                            : hasAnswered && isSelected && !isCorrect
                                            ? 'bg-red-100 border-red-500 text-red-700'
                                            : 'border-gray-400 text-gray-600'
                                        }`}>
                                          {optIndex + 1}
                                        </div>
                                        <span className="flex-1">{option}</span>
                                        {hasAnswered && isCorrect && (
                                          <div className="text-green-600 font-bold">✓</div>
                                        )}
                                        {hasAnswered && isSelected && !isCorrect && (
                                          <div className="text-red-600 font-bold">✗</div>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              
                              {hasAnswered && (
                                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-start gap-2 mb-2">
                                    <div className={`font-medium ${
                                      userAnswer === quiz.correctAnswer ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                      {userAnswer === quiz.correctAnswer ? '정답입니다!' : '틀렸습니다.'}
                                    </div>
                                    {userAnswer !== quiz.correctAnswer && (
                                      <div className="text-sm text-gray-600">
                                        (정답: {quiz.correctAnswer + 1}번)
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-sm text-blue-800">
                                    <strong>해설:</strong> {quiz.explanation}
                                  </div>
                                </div>
                              )}
                              
                              {!hasAnswered && (
                                <div className="text-sm text-gray-500 italic">
                                  선택지를 클릭하여 답안을 확인하세요
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold mb-2">AI 안전 브리핑 생성 중...</h3>
                <p className="text-gray-600">
                  종합적인 안전 분석을 수행하고 있습니다. 잠시만 기다려주세요.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}