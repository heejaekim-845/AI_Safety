import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEquipment } from "@/hooks/useEquipment";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import RiskLevelBadge from "@/components/RiskLevelBadge";
import { 
  ArrowLeft, 
  Shield, 
  AlertTriangle, 
  History, 
  Phone, 
  Play,
  Pause,
  Square,
  Equal,
  Settings
} from "lucide-react";
import type { Incident } from "@shared/schema";

export default function EquipmentDashboard() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [isPlayingGuide, setIsPlayingGuide] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  
  const equipmentId = parseInt(id || "0");
  
  const { data: equipment, isLoading: equipmentLoading } = useEquipment(equipmentId);
  
  const { data: incidents } = useQuery({
    queryKey: [`/api/equipment/${equipmentId}/incidents`],
    enabled: !!equipmentId
  });

  const { data: voiceGuide } = useQuery({
    queryKey: [`/api/ai/voice-guide`, equipmentId],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/ai/voice-guide", { equipmentId });
      return response.json();
    },
    enabled: !!equipmentId
  });

  const handlePlayVoiceGuide = () => {
    if (voiceGuide?.guide && 'speechSynthesis' in window) {
      if (isPaused && currentUtterance) {
        // Resume paused audio
        speechSynthesis.resume();
        setIsPaused(false);
        return;
      }
      
      // Start new playback
      setIsPlayingGuide(true);
      setIsPaused(false);
      const utterance = new SpeechSynthesisUtterance(voiceGuide.guide);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9; // Slightly slower for better comprehension
      utterance.onend = () => {
        setIsPlayingGuide(false);
        setIsPaused(false);
        setCurrentUtterance(null);
      };
      utterance.onerror = () => {
        setIsPlayingGuide(false);
        setIsPaused(false);
        setCurrentUtterance(null);
      };
      setCurrentUtterance(utterance);
      speechSynthesis.speak(utterance);
    }
  };

  const handlePauseVoiceGuide = () => {
    if ('speechSynthesis' in window && isPlayingGuide) {
      speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleStopVoiceGuide = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsPlayingGuide(false);
      setIsPaused(false);
      setCurrentUtterance(null);
    }
  };

  const handleWorkTypeSelection = () => {
    setLocation(`/equipment/${equipmentId}/work-types`);
  };

  if (equipmentLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">설비 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">설비를 찾을 수 없습니다.</p>
        <Button onClick={() => setLocation("/")} className="mt-4">
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  const riskCounts = {
    high: (incidents as Incident[])?.filter(i => i.severity === 'HIGH').length || 0,
    medium: (incidents as Incident[])?.filter(i => i.severity === 'MEDIUM').length || 0,
    low: (incidents as Incident[])?.filter(i => i.severity === 'LOW').length || 0,
  };

  return (
    <div>
      {/* Equipment Header */}
      <div className="bg-primary text-white p-6">
        <div className="flex items-center mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-white hover:bg-white/10 p-1 mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-medium">설비 정보</h2>
        </div>
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="text-xl font-medium mb-3">{equipment.name}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="text-primary-100">CODE: {equipment.code}</p>
            <p className="text-primary-100">모델: {equipment.modelName || 'N/A'}</p>
            <p className="text-primary-100">위치: {equipment.location}</p>
            <p className="text-primary-100">제조사: {equipment.manufacturer || 'N/A'}</p>
            <p className="text-primary-100 col-span-2">설치년도: {equipment.installYear || 'N/A'}</p>
            {equipment.specification && (
              <p className="text-primary-100 col-span-2">규격: {equipment.specification}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Risk Level Visualization */}
        <Card className="material-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900">
              <AlertTriangle className="mr-2 h-5 w-5" />
              위험도 분석
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">전체 위험도</span>
              <RiskLevelBadge level={equipment.riskLevel} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-danger/10 rounded-lg">
                <div className="text-2xl font-bold text-danger">{riskCounts.high}</div>
                <div className="text-xs text-danger">고위험</div>
              </div>
              <div className="p-3 bg-warning/10 rounded-lg">
                <div className="text-2xl font-bold text-warning">{riskCounts.medium}</div>
                <div className="text-xs text-warning">중위험</div>
              </div>
              <div className="p-3 bg-success/10 rounded-lg">
                <div className="text-2xl font-bold text-success">{riskCounts.low}</div>
                <div className="text-xs text-success">저위험</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipment Details */}
        <Card className="material-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900">
              <Settings className="mr-2 h-5 w-5" />
              설비 상세 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">제조사:</span>
                <span className="font-medium">{equipment.manufacturer || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">모델명:</span>
                <span className="font-medium">{equipment.modelName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">설치년도:</span>
                <span className="font-medium">{equipment.installYear || 'N/A'}</span>
              </div>
              {equipment.specification && (
                <div className="flex justify-between">
                  <span className="text-gray-600">사양:</span>
                  <span className="font-medium">{equipment.specification}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Hazardous Chemicals Information */}
        <Card className="material-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900">
              <AlertTriangle className="mr-2 h-5 w-5" />
              유해화학물질 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            {equipment.hazardousChemicalType || equipment.hazardousChemicalName ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">화학물질 유형:</span>
                  <span className="font-medium">{equipment.hazardousChemicalType || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">화학물질명:</span>
                  <span className="font-medium">{equipment.hazardousChemicalName || 'N/A'}</span>
                </div>
                {equipment.riskManagementZone && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">위험관리구역:</span>
                    <span className="font-medium">{equipment.riskManagementZone}</span>
                  </div>
                )}
                <div className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                  <p className="text-sm text-orange-800">
                    ⚠️ 유해화학물질 취급 시 반드시 안전수칙을 준수하세요
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                  <p className="text-sm text-green-800">
                    ✓ 해당 없음 - 유해화학물질이 사용되지 않는 설비입니다
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Major Risk Factors */}
        <Card className="material-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900">
              <AlertTriangle className="mr-2 h-5 w-5" />
              주요 위험 요소
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {equipment.highTemperatureRisk && (
                <Card className="material-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-danger mr-2">whatshot</span>
                      <span className="text-sm font-medium">고온 위험</span>
                    </div>
                    <p className="text-xs text-gray-600">150°C 이상</p>
                  </CardContent>
                </Card>
              )}
              
              {equipment.highPressureRisk && (
                <Card className="material-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-warning mr-2">compress</span>
                      <span className="text-sm font-medium">고압 가스</span>
                    </div>
                    <p className="text-xs text-gray-600">15 bar</p>
                  </CardContent>
                </Card>
              )}
              
              {equipment.electricalRisk && (
                <Card className="material-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-warning mr-2">electrical_services</span>
                      <span className="text-sm font-medium">전기적 위험</span>
                    </div>
                    <p className="text-xs text-gray-600">전기 차단 필요</p>
                  </CardContent>
                </Card>
              )}
              
              {equipment.rotatingPartsRisk && (
                <Card className="material-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-warning mr-2">360</span>
                      <span className="text-sm font-medium">회전체 위험</span>
                    </div>
                    <p className="text-xs text-gray-600">느슨한 의복 금지</p>
                  </CardContent>
                </Card>
              )}
              
              {equipment.heightRisk && (
                <Card className="material-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-warning mr-2">height</span>
                      <span className="text-sm font-medium">고소 작업</span>
                    </div>
                    <p className="text-xs text-gray-600">추락 위험</p>
                  </CardContent>
                </Card>
              )}
              
              {equipment.highVoltageRisk && (
                <Card className="material-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-danger mr-2">flash_on</span>
                      <span className="text-sm font-medium">고전압</span>
                    </div>
                    <p className="text-xs text-gray-600">위험 전압</p>
                  </CardContent>
                </Card>
              )}
              
              {equipment.heavyWeightRisk && (
                <Card className="material-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-warning mr-2">fitness_center</span>
                      <span className="text-sm font-medium">고중량</span>
                    </div>
                    <p className="text-xs text-gray-600">중량물 주의</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Safety Equipment Information */}
        {equipment.requiredSafetyEquipment && equipment.requiredSafetyEquipment.length > 0 && (
          <Card className="material-shadow">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900">
                <Shield className="mr-2 h-5 w-5" />
                안전 장비 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {equipment.requiredSafetyEquipment.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{item}</span>
                    <Badge variant="secondary" className="bg-success text-white">필수</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Incidents */}
        {incidents && incidents.length > 0 && (
          <Card className="material-shadow">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900">
                <History className="mr-2 h-5 w-5" />
                최근 사고 이력
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(incidents as Incident[]).slice(0, 3).map((incident) => (
                  <div 
                    key={incident.id} 
                    className={`border-l-4 pl-4 ${
                      incident.severity === 'HIGH' ? 'border-danger' : 
                      incident.severity === 'MEDIUM' ? 'border-warning' : 'border-success'
                    }`}
                  >
                    <p className="text-sm font-medium">{incident.title}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(incident.incidentDate).toLocaleDateString('ko-KR')} - {incident.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Emergency Contacts */}
        {equipment.emergencyContacts && equipment.emergencyContacts.length > 0 && (
          <Card className="material-shadow">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900">
                <Phone className="mr-2 h-5 w-5" />
                비상연락처
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {equipment.emergencyContacts.map((contact, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{contact.role} - {contact.name}</span>
                    <a href={`tel:${contact.phone}`} className="text-primary text-sm hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Voice Guide */}
        <Card className="bg-primary/5 border-primary/20 material-shadow">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <span className="material-icons text-primary">record_voice_over</span>
              <div className="flex-1">
                <h4 className="font-medium text-primary mb-1">AI 음성 안내</h4>
                <p className="text-sm text-primary/80 mb-3">
                  현재 설비의 주요 위험 요소와 안전 수칙을 음성으로 안내받을 수 있습니다.
                </p>
                <div className="flex gap-2">
                  {!isPlayingGuide && !isPaused ? (
                    <Button 
                      onClick={handlePlayVoiceGuide}
                      className="bg-primary hover:bg-primary/90 text-white"
                      size="sm"
                    >
                      <Play className="mr-1 h-4 w-4" />
                      음성 안내 시작
                    </Button>
                  ) : isPaused ? (
                    <>
                      <Button 
                        onClick={handlePlayVoiceGuide}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Play className="mr-1 h-4 w-4" />
                        재생
                      </Button>
                      <Button 
                        onClick={handleStopVoiceGuide}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="mr-1 h-4 w-4" />
                        정지
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        onClick={handlePauseVoiceGuide}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                        size="sm"
                      >
                        <Pause className="mr-1 h-4 w-4" />
                        일시정지
                      </Button>
                      <Button 
                        onClick={handleStopVoiceGuide}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="mr-1 h-4 w-4" />
                        정지
                      </Button>
                    </>
                  )}
                </div>
                {isPlayingGuide && !isPaused && (
                  <div className="mt-2 flex items-center text-xs text-primary/70">
                    <div className="animate-pulse w-2 h-2 bg-primary rounded-full mr-2"></div>
                    음성 안내 재생 중...
                  </div>
                )}
                {isPaused && (
                  <div className="mt-2 flex items-center text-xs text-yellow-600">
                    <Pause className="w-3 h-3 mr-1" />
                    일시정지됨
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Type Selection Button */}
        <Button 
          onClick={handleWorkTypeSelection}
          className="w-full bg-primary hover:bg-primary/90 text-white py-4 font-medium material-shadow-lg"
          size="lg"
        >
          <Equal className="mr-2 h-5 w-5" />
          작업 유형 선택
        </Button>
      </div>
    </div>
  );
}