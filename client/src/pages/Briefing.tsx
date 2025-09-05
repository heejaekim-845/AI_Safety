import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Eye, Shield, BookOpen, AlertTriangle, Clock, MapPin, Thermometer, Wind, Droplets, Plus, Edit, Trash2, User, CheckCircle, Wrench, HardHat, ScrollText, History, GraduationCap, Zap, ChevronDown, ChevronUp, Scale, FileText } from "lucide-react";
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

interface LegalRecommendation {
  category: string;
  title: string;
  articleNumber: string;
  content: string;
  relevance: string;
}

interface LegalRecommendationsData {
  workSummary: string;
  equipmentName: string;
  workType: string;
  riskLevel: string;
  recommendations: {
    industrialSafetyHealth: LegalRecommendation[];
    administrativeRules: LegalRecommendation[];
    koshaGuide: LegalRecommendation[];
    mechanicalEquipmentLaw: LegalRecommendation[];
    kec: LegalRecommendation[];
  };
}

interface HourlyForecast {
  time: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainfall: number;
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
    hourlyForecast?: HourlyForecast[];
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
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<{[key: number]: number}>({});
  const [expandedRegulations, setExpandedRegulations] = useState<{[key: number]: boolean}>({});
  const [legalData, setLegalData] = useState<LegalRecommendationsData | null>(null);
  const [isLoadingLegal, setIsLoadingLegal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const queryClient = useQueryClient();

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  // Fetch all work schedules to show dots on calendar
  const { data: allWorkSchedules = [] } = useQuery({
    queryKey: ['/api/work-schedules'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/work-schedules');
      return response.json();
    },
  });

  // Fetch work schedules for selected date
  const { data: workSchedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['/api/work-schedules', dateString],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/work-schedules?date=${dateString}`);
      return response.json();
    },
  });

  // Create a set of dates that have work schedules
  const datesWithWork = new Set(
    allWorkSchedules.map((schedule: WorkSchedule) => {
      const scheduleDate = new Date(schedule.scheduledDate);
      return format(scheduleDate, 'yyyy-MM-dd');
    })
  );

  // Custom day renderer for calendar
  const renderDay = (day: Date) => {
    const dayString = format(day, 'yyyy-MM-dd');
    const hasWork = datesWithWork.has(dayString);
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span className="z-10">{format(day, 'd')}</span>
        {hasWork && (
          <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-600 rounded-full z-20"></div>
        )}
      </div>
    );
  };

  // Generate safety briefing with progress tracking
  const generateBriefingWithProgress = async (workScheduleId: number) => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setCurrentStep('작업 정보 분석 중...');
    
    // Progress simulation steps
    const progressSteps = [
      { progress: 15, step: '설비 위험 요소 분석 중...', duration: 3000 },
      { progress: 25, step: '기상 정보 수집 중...', duration: 3000 },
      { progress: 35, step: 'RAG 데이터베이스 검색 중...', duration: 3000 },
      { progress: 50, step: '유사 사고사례 검색 중...', duration: 3000 },
      { progress: 65, step: '관련 법규 검색 중...', duration: 3000 },
      { progress: 75, step: '안전 교육자료 검색 중...', duration: 3000 },
      { progress: 85, step: 'AI 안전 분석 수행 중...', duration: 3000 },
      { progress: 95, step: '브리핑 문서 생성 중...', duration: 3000 }
    ];

    let currentStepIndex = 0;
    let stepStartTime = Date.now();

    // Start the API call with timeout
    const apiPromise = Promise.race([
      apiRequest('POST', `/api/generate-safety-briefing/${workScheduleId}`),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('브리핑 생성 시간이 초과되었습니다.')), 120000) // 2분 타임아웃
      )
    ]);

    // Progress simulation that syncs with actual API timing
    const progressInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - stepStartTime;
      
      if (currentStepIndex < progressSteps.length) {
        const step = progressSteps[currentStepIndex];
        
        // Move to next step if duration has passed
        if (elapsed >= step.duration) {
          setGenerationProgress(step.progress);
          setCurrentStep(step.step);
          currentStepIndex++;
          stepStartTime = now;
        } else {
          // Smooth progress within current step
          const prevProgress = currentStepIndex > 0 ? progressSteps[currentStepIndex - 1].progress : 0;
          const stepProgress = (elapsed / step.duration) * (step.progress - prevProgress);
          setGenerationProgress(Math.floor(prevProgress + stepProgress));
        }
      }
    }, 200); // More frequent updates for smoother animation

    try {
      const response = await apiPromise as Response;
      const data = await response.json();
      
      // Immediately complete progress when API finishes
      clearInterval(progressInterval);
      setGenerationProgress(100);
      setCurrentStep('브리핑 생성 완료!');
      
      // Short delay before showing results
      setTimeout(() => {
        setBriefingData(data);
        setQuizAnswers({});
        setExpandedRegulations({});
        setIsGenerating(false);
        setGenerationProgress(0);
        setCurrentStep('');
      }, 500);
      
    } catch (error) {
      clearInterval(progressInterval);
      console.error('브리핑 생성 오류:', error);
      
      // Show error state
      setGenerationProgress(0);
      setCurrentStep('브리핑 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
      
      // Clear error state after 3 seconds
      setTimeout(() => {
        setIsGenerating(false);
        setCurrentStep('');
      }, 3000);
    }
  };

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
    await generateBriefingWithProgress(workSchedule.id);
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (confirm('이 작업 일정을 삭제하시겠습니까?')) {
      deleteScheduleMutation.mutate(scheduleId);
    }
  };

  const handleLegalRecommendations = async () => {
    if (!selectedWorkSchedule) return;
    
    setIsLoadingLegal(true);
    try {
      const response = await apiRequest('POST', `/api/legal-recommendations/${selectedWorkSchedule.id}`);
      const data = await response.json();
      setLegalData(data);
      setShowLegalModal(true);
    } catch (error) {
      console.error('법령 검색 오류:', error);
      alert('법령 및 기준 검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingLegal(false);
    }
  };

  const handleQuizAnswer = (quizIndex: number, selectedOption: number) => {
    setQuizAnswers(prev => ({
      ...prev,
      [quizIndex]: selectedOption
    }));
  };

  const toggleRegulationExpansion = (index: number) => {
    setExpandedRegulations(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // 작업 시간이 지났는지 확인하는 함수
  const isWorkTimeExpired = (schedule: WorkSchedule) => {
    if (!schedule.briefingTime || !schedule.scheduledDate) {
      return false;
    }
    
    try {
      const now = new Date();
      
      // scheduledDate가 ISO 문자열인 경우 날짜 부분만 추출
      const dateOnly = schedule.scheduledDate.split('T')[0];
      const scheduledDateTimeString = `${dateOnly}T${schedule.briefingTime}:00`;
      const scheduledDateTime = new Date(scheduledDateTimeString);
      
      // 유효한 날짜인지 확인
      if (isNaN(scheduledDateTime.getTime())) {
        console.warn('유효하지 않은 날짜:', scheduledDateTimeString);
        return false;
      }
      

      
      return now > scheduledDateTime;
    } catch (error) {
      console.error('시간 비교 오류:', error);
      return false;
    }
  };

  // 뱃지 상태와 스타일을 결정하는 함수
  const getBadgeInfo = (schedule: WorkSchedule) => {
    if (schedule.status === 'completed') {
      return { variant: 'secondary' as const, text: '완료', className: 'bg-green-100 text-green-800 hover:bg-green-200' };
    }
    
    if (schedule.status === 'scheduled') {
      if (isWorkTimeExpired(schedule)) {
        return { variant: 'secondary' as const, text: '종료', className: 'bg-gray-100 text-gray-600 hover:bg-gray-200' };
      }
      return { variant: 'default' as const, text: '예정', className: '' };
    }
    
    return { variant: 'secondary' as const, text: schedule.status, className: '' };
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-2">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
              <CardContent className="p-1 sm:p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ko}
                  className="w-full"
                  components={{
                    DayContent: ({ date }) => renderDay(date)
                  }}
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
                    day: "h-8 sm:h-10 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground text-center rounded-md relative",
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
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">
                                {schedule.equipmentName && schedule.workTypeName 
                                  ? `${schedule.equipmentName} - ${schedule.workTypeName}`
                                  : '작업 설명 없음'
                                }
                              </h3>
                              {(() => {
                                const badgeInfo = getBadgeInfo(schedule);
                                return (
                                  <Badge 
                                    variant={badgeInfo.variant}
                                    className={badgeInfo.className}
                                  >
                                    {badgeInfo.text}
                                  </Badge>
                                );
                              })()}
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
                              className="bg-blue-600 hover:bg-blue-700 w-full"
                            >
                              AI 안전브리핑
                            </Button>
                            <div className="flex gap-2 w-full">
                              <WorkScheduleForm 
                                trigger={
                                  <Button variant="outline" size="sm" className="flex-1">
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
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1"
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

        {/* Briefing Generation Progress Dialog */}
        {isGenerating && (
          <Dialog open={isGenerating} onOpenChange={() => {}}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center text-xl mb-4">
                  AI 안전 브리핑 생성중...
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 mb-3">
                    {currentStep}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.floor(generationProgress)}%` }}
                    />
                  </div>
                  <div className="text-lg font-bold text-blue-600">
                    {Math.floor(generationProgress)}%
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600 text-center">
                    조금만 기다려주세요<br />약 1분 가량 소요됩니다
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Safety Briefing Dialog */}
        {briefingData && (
          <Dialog open={!!briefingData} onOpenChange={() => setBriefingData(null)}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-3">
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
                    {selectedWorkSchedule?.briefingTime && (
                      <span className="ml-2">
                        • {selectedWorkSchedule.briefingTime}
                      </span>
                    )}
                  </p>
                </div>
              </DialogHeader>

              <div className="space-y-3">
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
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-5 h-5" />
                        날씨 정보
                      </div>
                      {briefingData.weatherInfo && (
                        <div className="text-sm text-gray-600 font-normal">
                          <MapPin className="w-4 h-4 inline mr-1" />
                          {briefingData.weatherInfo.location}
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {briefingData.weatherInfo ? (
                      <>
                        <div className="flex flex-wrap items-center justify-center gap-4 mb-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Thermometer className="w-5 h-5 text-red-500" />
                            <span className="text-xl font-bold">{briefingData.weatherInfo.temperature}°C</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Droplets className="w-5 h-5 text-blue-500" />
                            <span className="text-xl font-bold">{briefingData.weatherInfo.humidity}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Wind className="w-5 h-5 text-green-500" />
                            <span className="text-xl font-bold">{briefingData.weatherInfo.windSpeed}m/s</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-gray-700">{briefingData.weatherInfo.condition}</span>
                          </div>
                        </div>

                        {/* 작업시간 기준 날씨 안내 */}
                        {selectedWorkSchedule?.briefingTime && (
                          <div className="mt-2 text-center text-xs text-gray-500">
                            작업시간({selectedWorkSchedule.briefingTime}) 기준 날씨입니다
                          </div>
                        )}

                        {/* 시간대별 예보 (작업시간 기준 고정 표시) */}
                        <div className="mt-4">
                          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            시간대별 예보 (작업시간 기준 ±2시간)
                          </h4>
                          <div className="flex gap-1 flex-wrap justify-center sm:gap-2">
                              {(() => {
                                // 현재 시간과 날짜
                                const now = new Date();
                                const currentHour = now.getHours();
                                // const today = now.toISOString().split('T')[0];
                                // const weatherDate = (briefingData.weatherInfo as any).weatherDate || today;

                                // 시간 타입 판단 함수 - 주석처리 (예보 데이터만 사용)
                                // const getTimeType = (hourTime: string) => {
                                //   const hourNum = parseInt(hourTime.split(':')[0]);
                                //   
                                //   // 날짜가 다르면 미래/과거로 판단
                                //   if (weatherDate !== today) {
                                //     return weatherDate > today ? '미래' : '과거';
                                //   }
                                //   
                                //   // 같은 날이면 시간으로 판단
                                //   if (hourNum < currentHour) {
                                //     return '과거';
                                //   } else if (hourNum === currentHour) {
                                //     return '현재';
                                //   } else {
                                //     return '미래';
                                //   }
                                // };

                                // 타입별 스타일 반환 함수 - 주석처리 (예보 데이터만 사용)
                                // const getTypeStyle = (type: string, isWorkTime: boolean) => {
                                //   if (isWorkTime) {
                                //     return 'bg-blue-100 border-2 border-blue-300';
                                //   }
                                //   
                                //   switch (type) {
                                //     case '과거':
                                //       return 'bg-gray-100 border border-gray-300';
                                //     case '현재':
                                //       return 'bg-green-50 border border-green-300';
                                //     case '미래':
                                //       return 'bg-orange-50 border border-orange-300';
                                //     default:
                                //       return 'bg-white';
                                //   }
                                // };

                                // 타입별 라벨 색상 반환 함수 - 주석처리 (예보 데이터만 사용)
                                // const getTypeLabelStyle = (type: string, isWorkTime: boolean) => {
                                //   if (isWorkTime) {
                                //     return 'text-blue-700';
                                //   }
                                //   
                                //   switch (type) {
                                //     case '과거':
                                //       return 'text-gray-600';
                                //     case '현재':
                                //       return 'text-green-600';
                                //     case '미래':
                                //       return 'text-orange-600';
                                //     default:
                                //       return 'text-gray-600';
                                //   }
                                // };

                                // 빈 슬롯 생성 함수 - 상대적 시간 표현
                                const createEmptySlot = (time: string, isWorkTime: boolean, relativeHour: number) => {
                                  const getTimeLabel = () => {
                                    if (isWorkTime) return '작업시간';
                                    if (relativeHour < 0) return `${relativeHour}h`;
                                    if (relativeHour > 0) return `+${relativeHour}h`;
                                    return '작업시간';
                                  };
                                  
                                  return (
                                    <div key={time} className={`flex flex-col items-center p-1.5 rounded-md shadow-sm min-w-[60px] flex-shrink-0 ${isWorkTime ? 'bg-blue-100 border-2 border-blue-300' : 'bg-gray-200 border border-gray-300'}`}>
                                      <div className={`text-xs font-medium ${isWorkTime ? 'text-blue-700' : 'text-gray-500'}`}>
                                        {time}
                                        <div className="text-xs">{getTimeLabel()}</div>
                                      </div>
                                      <div className="text-sm text-gray-400 mt-1">--°C</div>
                                      <div className="text-xs text-gray-400 mt-1">--</div>
                                    </div>
                                  );
                                };

                                // 작업 시간 추출 (HH:mm 형식) - 기본값은 현재 시간
                                const workTime = selectedWorkSchedule?.briefingTime;
                                const workHour = workTime ? parseInt(workTime.split(':')[0]) : currentHour;
                                
                                // 고정 시간대: 작업시간 -2, -1, 0, +1, +2
                                const targetHours = [workHour-2, workHour-1, workHour, workHour+1, workHour+2];
                                const timeSlots = targetHours.map(hour => {
                                  // 24시간 형식으로 조정
                                  const normalizedHour = ((hour % 24) + 24) % 24;
                                  return normalizedHour.toString().padStart(2, '0') + ':00';
                                });

                                return timeSlots.map((timeSlot, index) => {
                                  const hourNum = parseInt(timeSlot.split(':')[0]);
                                  const isWorkTime = hourNum === workHour;
                                  const relativeHour = hourNum - workHour; // 작업시간 기준 상대적 시간 계산
                                  
                                  // 시간 라벨 생성 함수
                                  const getTimeLabel = () => {
                                    if (isWorkTime) return '작업시간';
                                    if (relativeHour < 0) return `${relativeHour}h`;
                                    if (relativeHour > 0) return `+${relativeHour}h`;
                                    return '작업시간';
                                  };
                                  
                                  // 해당 시간대의 예보 데이터 찾기
                                  const forecastData = briefingData.weatherInfo?.hourlyForecast?.find(hour => 
                                    hour.time === timeSlot
                                  );

                                  if (!forecastData) {
                                    // 데이터가 없으면 빈 슬롯 표시
                                    return createEmptySlot(timeSlot, isWorkTime, relativeHour);
                                  }

                                  // 예보 데이터만 사용 - 시간 타입 판단 로직 제거
                                  // const timeType = getTimeType(timeSlot);
                                  
                                  return (
                                    <div key={index} className={`flex flex-col items-center p-1.5 rounded-md shadow-sm min-w-[60px] flex-shrink-0 ${isWorkTime ? 'bg-blue-100 border-2 border-blue-300' : 'bg-orange-50 border border-orange-300'}`}>
                                      <div className={`text-xs font-medium ${isWorkTime ? 'text-blue-700' : 'text-orange-600'}`}>
                                        {timeSlot}
                                        <div className="text-xs">
                                          {getTimeLabel()}
                                        </div>
                                      </div>
                                      <div className="text-sm font-bold mt-1">{forecastData.temperature}°C</div>
                                      <div className="text-xs text-gray-600 mt-1">{forecastData.condition}</div>
                                      {forecastData.rainfall > 0 && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <Droplets className="w-3 h-3 text-blue-500" />
                                          <span className="text-xs text-blue-600">{forecastData.rainfall}mm</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                          {briefingData.riskFactors?.map((factor, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                              <span className="text-sm">{factor}</span>
                            </li>
                          )) || []}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Wrench className="w-5 h-5" />
                        필요한 작업도구
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {briefingData.requiredTools?.map((tool, index) => {
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
                        }) || []}
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
                        {briefingData.requiredSafetyEquipment?.map((equipment, index) => {
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
                        }) || []}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Related Accident History - Moved below Required Safety Equipment */}
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
                      {briefingData.safetyRecommendations?.map((recommendation, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <span className="text-green-800 text-sm leading-relaxed">{recommendation}</span>
                          </div>
                        </div>
                      )) || []}
                    </div>
                  </CardContent>
                </Card>

                {/* Related Information Tabs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <ScrollText className="w-5 h-5" />
                          관련 법령 및 규정
                        </CardTitle>
                        <Button
                          onClick={handleLegalRecommendations}
                          disabled={isLoadingLegal}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 animate-pulse hover:animate-none transition-all duration-500 hover:scale-105 hover:shadow-lg border-blue-500 text-blue-600 hover:bg-blue-50"
                          style={{ animationDuration: '2s' }}
                        >
                          {isLoadingLegal ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          ) : (
                            <Scale className="w-4 h-4" />
                          )}
                          AI추천 법령 검색
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {briefingData.regulations && briefingData.regulations.length > 0 ? (
                          briefingData.regulations.map((reg: any, index) => {
                            const isExpanded = expandedRegulations[index];
                            const content = reg.summary || reg.content;
                            
                            return (
                              <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="mb-3">
                                  <div className="font-bold text-blue-900 text-base mb-1">
                                    {reg.lawName || '산업안전보건기준에 관한 규칙'}
                                  </div>
                                  <div className="font-semibold text-blue-800">
                                    {reg.articleNumber}{reg.articleTitle ? `(${reg.articleTitle})` : ''}
                                  </div>
                                </div>
                                <div className="relative">
                                  <div 
                                    className={`text-blue-700 text-sm leading-relaxed bg-white p-3 rounded border border-blue-100 ${
                                      !isExpanded ? 'line-clamp-2 overflow-hidden' : ''
                                    }`}
                                    style={{
                                      display: !isExpanded ? '-webkit-box' : 'block',
                                      WebkitLineClamp: !isExpanded ? 2 : 'none',
                                      WebkitBoxOrient: !isExpanded ? 'vertical' : 'initial',
                                    }}
                                  >
                                    {content}
                                  </div>
                                  {!isExpanded && content && content.length > 100 && (
                                    <div 
                                      className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"
                                    />
                                  )}
                                  {content && content.length > 100 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleRegulationExpansion(index)}
                                      className="mt-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-2 h-auto"
                                    >
                                      {isExpanded ? (
                                        <>
                                          <ChevronUp className="w-4 h-4 mr-1" />
                                          접기
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="w-4 h-4 mr-1" />
                                          더보기
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
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
                        <GraduationCap className="w-5 h-5" />
                        교육자료
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {briefingData.educationMaterials && briefingData.educationMaterials.length > 0 ? (
                          briefingData.educationMaterials.map((material: any, index) => (
                            <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="mb-3">
                                <div className="font-bold text-blue-900 text-base mb-1">
                                  {material.url ? (
                                    <a 
                                      href={material.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="hover:underline text-blue-900 hover:text-blue-800"
                                    >
                                      {material.title} ↗
                                    </a>
                                  ) : (
                                    material.title
                                  )}
                                </div>
                                <div className="font-semibold text-blue-800">
                                  {material.type}
                                </div>
                              </div>
                              {material.content && (
                                <div className="text-blue-700 text-sm leading-relaxed bg-white p-3 rounded border border-blue-100">
                                  {material.content.length > 200 ? `${material.content.substring(0, 200)}...` : material.content}
                                </div>
                              )}
                              {(material.keywords || material.date) && (
                                <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
                                  {material.keywords && (
                                    <div className="text-blue-600 text-xs">키워드: {material.keywords}</div>
                                  )}
                                  {material.date && (
                                    <div className="text-blue-500 text-xs">발행일: {material.date}</div>
                                  )}
                                </div>
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
                    <div className="space-y-3">
                      {briefingData.relatedIncidents && briefingData.relatedIncidents.length > 0 ? (
                        briefingData.relatedIncidents.map((accident: any, index: number) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            {/* Header with title and severity badge */}
                            <div className="mb-3">
                              <div className="flex items-start justify-between mb-1">
                                <h4 className="font-bold text-blue-900 text-base leading-tight">{accident.title}</h4>
                                <Badge className="bg-red-100 text-red-800 border-red-200 font-semibold text-xs">
                                  HIGH
                                </Badge>
                              </div>
                            </div>
                            
                            {/* 5x2 Grid Layout for Accident Information */}
                            <div className="grid grid-cols-5 gap-2 mb-3">
                              {/* Row 1 */}
                              <div className="bg-gray-100 border border-gray-300 rounded px-2 py-1 flex items-center justify-center">
                                <div className="text-xs font-semibold text-gray-600 text-center">사고일시</div>
                              </div>
                              <div className="bg-gray-100 border border-gray-300 rounded px-2 py-1 col-span-4 flex items-center">
                                <div className="text-xs text-gray-900">{accident.date || '미기재'}</div>
                              </div>
                              
                              {/* Row 2 */}
                              <div className="bg-gray-100 border border-gray-300 rounded px-2 py-1 flex items-center justify-center">
                                <div className="text-xs font-semibold text-gray-600 text-center">사고장소</div>
                              </div>
                              <div className="bg-gray-100 border border-gray-300 rounded px-2 py-1 col-span-4 flex items-center">
                                <div className="text-xs text-gray-900">{accident.location || '미기재'}</div>
                              </div>
                              
                              {/* Row 3 */}
                              <div className="bg-red-50 border border-red-300 rounded px-2 py-1 flex items-center justify-center">
                                <div className="text-xs font-semibold text-red-600 text-center">피해규모</div>
                              </div>
                              <div className="bg-red-50 border border-red-300 rounded px-2 py-1 col-span-4 flex items-center">
                                <div className="text-xs text-red-900 font-medium">{accident.damage || '미기재'}</div>
                              </div>
                              
                              {/* Row 4 */}
                              <div className="bg-blue-50 border border-blue-300 rounded px-2 py-1 flex items-center justify-center">
                                <div className="text-xs font-semibold text-blue-600 text-center">사고내용</div>
                              </div>
                              <div className="bg-blue-50 border border-blue-300 rounded px-2 py-1 col-span-4 flex items-center">
                                <div className="text-xs text-blue-900 leading-relaxed">
                                  {accident.summary ? (accident.summary.length > 100 ? `${accident.summary.substring(0, 100)}...` : accident.summary) : '미기재'}
                                </div>
                              </div>
                              
                              {/* Row 5 */}
                              <div className="bg-green-50 border border-green-300 rounded px-2 py-1 flex items-center justify-center">
                                <div className="text-xs font-semibold text-green-600 text-center">예방대책</div>
                              </div>
                              <div className="bg-green-50 border border-green-300 rounded px-2 py-1 col-span-4 flex items-center">
                                <div className="text-xs text-green-900 font-medium leading-relaxed">
                                  {accident.prevention ? (accident.prevention.length > 100 ? `${accident.prevention.substring(0, 100)}...` : accident.prevention) : '미기재'}
                                </div>
                              </div>
                            </div>

                            {/* Additional details at bottom */}
                            {(accident.accident_type || accident.direct_cause || accident.root_cause || accident.risk_keywords) && (
                              <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                                {accident.accident_type && (
                                  <div className="text-blue-600 text-xs">사고형태: {accident.accident_type}</div>
                                )}
                                {accident.direct_cause && (
                                  <div className="text-blue-600 text-xs">직접원인: {accident.direct_cause}</div>
                                )}
                                {accident.root_cause && (
                                  <div className="text-blue-600 text-xs">근본원인: {accident.root_cause}</div>
                                )}
                                {accident.risk_keywords && (
                                  <div className="text-blue-500 text-xs">위험키워드: {accident.risk_keywords}</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 italic p-3 text-center bg-gray-50 rounded">
                          현재 작업과 관련된 사고사례가<br/>
                          검색되지 않았습니다.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

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
                        {briefingData.quizQuestions?.map((quiz: any, quizIndex) => {
                          const userAnswer = quizAnswers[quizIndex];
                          const hasAnswered = userAnswer !== undefined;
                          
                          return (
                            <div key={quizIndex} className="border rounded-lg p-4">
                              <h4 className="font-medium mb-4">Q{quizIndex + 1}. {quiz.question}</h4>
                              <div className="space-y-2 mb-4">
                                {quiz.options?.map((option: string, optIndex: number) => {
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

        {/* Legal Recommendations Dialog */}
        {legalData && (
          <Dialog open={showLegalModal} onOpenChange={setShowLegalModal}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-3">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="flex items-center gap-2 text-2xl mb-3">
                  <Scale className="w-7 h-7 text-green-600" />
                  AI추천 관련 법령 및 기준
                </DialogTitle>
                <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-3 rounded-lg">
                  <h2 className="text-xl font-bold text-center">
                    {legalData.equipmentName} - {legalData.workType}
                  </h2>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* 산업안전보건법 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="w-5 h-5 text-red-600" />
                      산업안전보건법 관련 조항
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {legalData.recommendations.industrialSafetyHealth.length > 0 ? (
                      <div className="space-y-3">
                        {legalData.recommendations.industrialSafetyHealth.map((item, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-red-50">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-red-800">{item.title}</h4>
                              <Badge variant="outline" className="text-red-600 border-red-300">
                                {item.articleNumber}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{item.content}</p>
                            <div className="text-xs text-red-600 bg-red-100 p-2 rounded">
                              <strong>관련성:</strong> {item.relevance}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">관련 조항이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>

                {/* 행정규칙 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ScrollText className="w-5 h-5 text-orange-600" />
                      행정규칙 (훈령, 고시, 예규)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {legalData.recommendations.administrativeRules.length > 0 ? (
                      <div className="space-y-3">
                        {legalData.recommendations.administrativeRules.map((item, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-orange-50">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-orange-800">{item.title}</h4>
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                {item.articleNumber}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{item.content}</p>
                            <div className="text-xs text-orange-600 bg-orange-100 p-2 rounded">
                              <strong>관련성:</strong> {item.relevance}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">관련 행정규칙이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>

                {/* KOSHA GUIDE */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="w-5 h-5 text-blue-600" />
                      KOSHA GUIDE
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {legalData.recommendations.koshaGuide.length > 0 ? (
                      <div className="space-y-3">
                        {legalData.recommendations.koshaGuide.map((item, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-blue-50">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-blue-800">{item.title}</h4>
                              <Badge variant="outline" className="text-blue-600 border-blue-300">
                                {item.articleNumber}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{item.content}</p>
                            <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                              <strong>관련성:</strong> {item.relevance}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">관련 KOSHA 가이드가 없습니다.</p>
                    )}
                  </CardContent>
                </Card>

                {/* 기계설비법 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wrench className="w-5 h-5 text-purple-600" />
                      기계설비법
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {legalData.recommendations.mechanicalEquipmentLaw.length > 0 ? (
                      <div className="space-y-3">
                        {legalData.recommendations.mechanicalEquipmentLaw.map((item, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-purple-50">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-purple-800">{item.title}</h4>
                              <Badge variant="outline" className="text-purple-600 border-purple-300">
                                {item.articleNumber}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{item.content}</p>
                            <div className="text-xs text-purple-600 bg-purple-100 p-2 rounded">
                              <strong>관련성:</strong> {item.relevance}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">관련 기계설비법이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>

                {/* KEC */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Zap className="w-5 h-5 text-yellow-600" />
                      KEC (한국전기설비규정)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {legalData.recommendations.kec.length > 0 ? (
                      <div className="space-y-3">
                        {legalData.recommendations.kec.map((item, index) => (
                          <div key={index} className="border rounded-lg p-3 bg-yellow-50">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-yellow-800">{item.title}</h4>
                              <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                {item.articleNumber}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{item.content}</p>
                            <div className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded">
                              <strong>관련성:</strong> {item.relevance}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">관련 KEC 규정이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
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