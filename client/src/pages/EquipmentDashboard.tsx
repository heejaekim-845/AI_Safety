import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEquipment } from "@/hooks/useEquipment";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import RiskLevelBadge from "@/components/RiskLevelBadge";
import nitrogenMsdsImage from "@assets/nitrogen_1_1750834174079.png";

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
  Settings,
  FileText,
  MapPin,
  X,
  Heart,
  CheckCircle,
  Volume2
} from "lucide-react";
import type { Incident } from "@shared/schema";

export default function EquipmentDashboard() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [isPlayingGuide, setIsPlayingGuide] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false); // 음성 생성 중 상태
  const [isPaused, setIsPaused] = useState(false);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [useGoogleTTS, setUseGoogleTTS] = useState(true); // Google TTS 우선 사용
  const [showSafetyDevices, setShowSafetyDevices] = useState(false);
  
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

  const handlePlayVoiceGuide = async () => {
    if (!voiceGuide?.guide) return;

    // 재생 중인 경우 재생/일시정지 토글
    if (isPaused && (currentUtterance || currentAudio)) {
      if (currentAudio) {
        currentAudio.play();
        setIsPaused(false);
      } else if (currentUtterance && 'speechSynthesis' in window) {
        speechSynthesis.resume();
        setIsPaused(false);
      }
      return;
    }

    // 음성 생성/재생 시작
    setIsGeneratingVoice(true);
    setIsPaused(false);

    // Google TTS 먼저 시도
    if (useGoogleTTS) {
      try {
        console.log('[VoiceGuide] Google TTS 시도 중...');
        
        const response = await fetch('/api/ai/google-tts-voice-guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ equipmentId })
        });

        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          audio.onended = () => {
            setIsPlayingGuide(false);
            setIsPaused(false);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.onerror = () => {
            console.error('[VoiceGuide] Google TTS 오디오 재생 오류');
            setIsPlayingGuide(false);
            setIsGeneratingVoice(false);
            setIsPaused(false);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
            // 폴백: Web Speech API 사용
            playWithWebSpeechAPI();
          };

          // 음성 생성 완료, 재생 시작
          setIsGeneratingVoice(false);
          setIsPlayingGuide(true);
          setCurrentAudio(audio);
          await audio.play();
          console.log('[VoiceGuide] Google TTS 재생 성공');
          return;
        } else {
          console.warn('[VoiceGuide] Google TTS API 실패, Web Speech API로 폴백');
          setIsGeneratingVoice(false);
        }
      } catch (error) {
        console.error('[VoiceGuide] Google TTS 오류:', error);
        setIsGeneratingVoice(false);
      }
    }

    // 폴백: Web Speech API 사용
    playWithWebSpeechAPI();
  };

  const playWithWebSpeechAPI = () => {
    if (voiceGuide?.guide && 'speechSynthesis' in window) {
      console.log('[VoiceGuide] Web Speech API 사용');
      
      const utterance = new SpeechSynthesisUtterance(voiceGuide.guide);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.1; // 20% 빠른 재생 속도
      
      utterance.onend = () => {
        setIsPlayingGuide(false);
        setIsPaused(false);
        setCurrentUtterance(null);
      };
      
      utterance.onerror = () => {
        setIsPlayingGuide(false);
        setIsGeneratingVoice(false);
        setIsPaused(false);
        setCurrentUtterance(null);
      };
      
      // Web Speech API는 즉시 재생 (생성 시간 없음)
      setIsGeneratingVoice(false);
      setIsPlayingGuide(true);
      setCurrentUtterance(utterance);
      speechSynthesis.speak(utterance);
    }
  };

  const handlePauseVoiceGuide = () => {
    if (currentAudio && isPlayingGuide) {
      currentAudio.pause();
      setIsPaused(true);
    } else if ('speechSynthesis' in window && isPlayingGuide) {
      speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleStopVoiceGuide = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setCurrentUtterance(null);
    }
    
    setIsPlayingGuide(false);
    setIsGeneratingVoice(false);
    setIsPaused(false);
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
    <div className="pb-20 fade-in min-h-screen bg-gray-50">
      {/* Equipment Header */}
      <div className="bg-blue-600 text-white p-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="text-white hover:bg-white/20 p-2 mr-4 rounded-xl"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h2 className="text-xl font-semibold">설비 정보</h2>
          </div>
          <div className="glass-effect p-4">
            <div className="flex gap-6">
              {equipment.imageUrl && (
                <div className="flex-shrink-0">
                  <img 
                    src={equipment.imageUrl} 
                    alt={equipment.name}
                    className="w-28 h-28 object-cover rounded-2xl border-2 border-white/30 shadow-xl"
                    onError={(e) => {
                      console.error('Image failed to load:', equipment.imageUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully:', equipment.imageUrl);
                    }}
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-4 text-white">{equipment.name}</h3>
                <div className="space-y-2 text-white/90">
                  <p className="text-lg">CODE: {equipment.code}</p>
                  <p className="text-lg">위치: {equipment.location}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 1. Equipment Details */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <Settings className="mr-3 h-6 w-6 text-blue-600" />
              설비 상세 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            {equipment.imageUrl && (
              <div className="mb-4">
                <img 
                  src={equipment.imageUrl} 
                  alt={equipment.name}
                  className="w-full h-48 object-cover rounded-lg border"
                  onError={(e) => {
                    console.error('Details image failed to load:', equipment.imageUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Details image loaded successfully:', equipment.imageUrl);
                  }}
                />
              </div>
            )}
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

        {/* 2. Risk Level Visualization */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <AlertTriangle className="mr-3 h-6 w-6 text-orange-600" />
              위험도 분석
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-700 font-medium">(AI) 종합 위험도</span>
              <RiskLevelBadge level={equipment.riskLevel} />
            </div>
            
            <div className="mb-3">
              <h4 className="text-gray-700 font-medium mb-2 text-center">사고이력 위험수준 통계</h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200/50 shadow-sm">
                  <div className="text-2xl font-bold text-red-600 mb-0.5">{riskCounts.high}</div>
                  <div className="text-xs text-red-700 font-medium">고위험</div>
                </div>
                <div className="p-3 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200/50 shadow-sm">
                  <div className="text-2xl font-bold text-yellow-600 mb-0.5">{riskCounts.medium}</div>
                  <div className="text-xs text-yellow-700 font-medium">중위험</div>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200/50 shadow-sm">
                  <div className="text-2xl font-bold text-green-600 mb-0.5">{riskCounts.low}</div>
                  <div className="text-xs text-green-700 font-medium">저위험</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Major Risk Factors */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <AlertTriangle className="mr-3 h-6 w-6 text-red-600" />
              주요 위험 요소
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {equipment.riskFactors?.highTemperature && (
                <Card className="card-minimal card-hover">
                  <CardContent className="p-3">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-red-600 mr-2 text-2xl">whatshot</span>
                      <span className="font-semibold text-gray-900">고온 위험</span>
                    </div>
                    {equipment.riskFactors?.highTemperatureDetail ? (
                      <p className="text-sm text-gray-600">{equipment.riskFactors.highTemperatureDetail}</p>
                    ) : (
                      <p className="text-sm text-gray-600">150°C 이상</p>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {equipment.riskFactors?.highPressure && (
                <Card className="card-minimal card-hover">
                  <CardContent className="p-3">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-orange-600 mr-2 text-2xl">compress</span>
                      <span className="font-semibold text-gray-900">고압 가스</span>
                    </div>
                    {equipment.riskFactors?.highPressureDetail ? (
                      <p className="text-sm text-gray-600">{equipment.riskFactors.highPressureDetail}</p>
                    ) : (
                      <p className="text-sm text-gray-600">15 bar</p>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {equipment.riskFactors?.highVoltage && (
                <Card className="card-minimal card-hover">
                  <CardContent className="p-3">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-yellow-600 mr-2 text-2xl">electrical_services</span>
                      <span className="font-semibold text-gray-900">고전압 위험</span>
                    </div>
                    {equipment.riskFactors?.highVoltageDetail ? (
                      <p className="text-sm text-gray-600">{equipment.riskFactors.highVoltageDetail}</p>
                    ) : (
                      <p className="text-sm text-gray-600">전기 차단 필요</p>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {equipment.riskFactors?.height && (
                <Card className="card-minimal card-hover">
                  <CardContent className="p-3">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-purple-600 mr-2 text-2xl">height</span>
                      <span className="font-semibold text-gray-900">추락 위험</span>
                    </div>
                    {equipment.riskFactors?.heightDetail ? (
                      <p className="text-sm text-gray-600">{equipment.riskFactors.heightDetail}</p>
                    ) : (
                      <p className="text-sm text-gray-600">2m 이상 고소작업</p>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {equipment.riskFactors?.mechanical && (
                <Card className="card-minimal card-hover">
                  <CardContent className="p-3">
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-gray-600 mr-2 text-2xl">fitness_center</span>
                      <span className="font-semibold text-gray-900">기계적 위험</span>
                    </div>
                    {equipment.riskFactors?.mechanicalDetail ? (
                      <p className="text-sm text-gray-600">{equipment.riskFactors.mechanicalDetail}</p>
                    ) : (
                      <p className="text-sm text-gray-600">회전체 및 중량물</p>
                    )}
                  </CardContent>
                </Card>
              )}

            </div>
            
            {/* Show message if no risk factors are present */}
            {!equipment.riskFactors?.highTemperature && !equipment.riskFactors?.highPressure && !equipment.riskFactors?.highVoltage && !equipment.riskFactors?.height && !equipment.riskFactors?.mechanical && (
              <div className="text-center py-4">
                <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                  <p className="text-sm text-green-800">
                    ✓ 특별한 위험 요소가 확인되지 않음
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Required Safety Equipment */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <Shield className="mr-3 h-6 w-6 text-green-600" />
              필수 안전장비
            </CardTitle>
          </CardHeader>
          <CardContent>
            {equipment.requiredSafetyEquipment && equipment.requiredSafetyEquipment.length > 0 ? (
              <ul className="space-y-2">
                {equipment.requiredSafetyEquipment.map((item: string, index: number) => (
                  <li key={index} className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">등록된 필수 안전장비가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 5. Hazardous Chemicals Information */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <AlertTriangle className="mr-3 h-6 w-6 text-orange-600" />
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
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">화학물질명:</span>
                    <span className="font-medium">{equipment.hazardousChemicalName || 'N/A'}</span>
                  </div>
                  {equipment.hazardousChemicalName && equipment.msdsImageUrl && (
                    <div className="flex justify-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            MSDS 정보보기
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-lg font-bold">
                              {equipment.hazardousChemicalName} MSDS (Material Safety Data Sheet)
                            </DialogTitle>
                          </DialogHeader>
                          <div className="mt-4">
                            {equipment.msdsImageUrl?.endsWith('.pdf') ? (
                              <div className="space-y-4">
                                <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                  <p className="text-gray-600 mb-4">
                                    MSDS PDF 문서를 보려면 아래 버튼을 클릭하세요
                                  </p>
                                  <div className="flex gap-3 justify-center">
                                    <Button
                                      onClick={() => window.open(equipment.msdsImageUrl, '_blank')}
                                      className="bg-blue-600 hover:bg-blue-700"
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      새 창에서 보기
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = equipment.msdsImageUrl || '';
                                        link.download = `${equipment.hazardousChemicalName}_MSDS.pdf`;
                                        link.click();
                                      }}
                                    >
                                      다운로드
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img 
                                src={equipment.msdsImageUrl} 
                                alt={`${equipment.hazardousChemicalName} MSDS 정보`} 
                                className="w-full h-auto border rounded-lg shadow-sm"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder-msds.png";
                                }}
                              />
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
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



        {/* Check Safety Device Location */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <Shield className="mr-3 h-6 w-6 text-blue-600" />
              안전장치 위치 확인
            </CardTitle>
          </CardHeader>
          <CardContent>
            {equipment.safetyDeviceImages && equipment.safetyDeviceImages.length > 0 ? (
              <div className="space-y-3">
                {equipment.safetyDeviceImages.map((device: any, index: number) => (
                  <div key={index} className="flex justify-center">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <MapPin className="mr-2 h-4 w-4" />
                          {device.name || `안전장치 ${index + 1}`} 위치보기
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-lg font-bold">
                            {device.name || `안전장치 ${index + 1}`} 위치 및 점검사항
                          </DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                          {device.imageUrl && (
                            <img 
                              src={device.imageUrl} 
                              alt={`${device.name} 위치도`} 
                              className="w-full h-auto border rounded-lg shadow-sm"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-safety-device.png";
                              }}
                            />
                          )}
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <h3 className="font-bold text-blue-900 mb-2">장치 정보</h3>
                            <div className="text-sm text-blue-800 space-y-1">
                              <div><strong>장치명:</strong> {device.name}</div>
                              <div><strong>위치:</strong> {device.location}</div>
                            </div>
                            <h3 className="font-bold text-blue-900 mb-2 mt-4">점검 체크리스트</h3>
                            <ul className="text-sm text-blue-800 space-y-1">
                              <li>• 안전장치 주변에 장애물이 없는지 확인</li>
                              <li>• 장치 작동 상태 확인 (매월 1회)</li>
                              <li>• 계기 정상 작동 확인</li>
                              <li>• 누출 흔적이 없는지 육안 점검</li>
                            </ul>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-gray-400">
                  <p className="text-sm text-gray-600">
                    안전장치 위치 이미지가 등록되지 않았습니다
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Safety Facilities Location */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <MapPin className="mr-3 h-6 w-6 text-green-600" />
              안전시설 위치 보기
            </CardTitle>
          </CardHeader>
          <CardContent>
            {equipment?.safetyFacilityLocations && equipment.safetyFacilityLocations.filter((facility: any) => facility.name && facility.name.trim()).length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {equipment.safetyFacilityLocations.filter((facility: any) => facility.name && facility.name.trim()).map((facility: any, index: number) => (
                  <Dialog key={index}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={`w-full ${
                          facility.type === 'FIRE_EXTINGUISHER' ? 'text-red-700 border-red-200 hover:bg-red-50' :
                          facility.type === 'AED' ? 'text-red-700 border-red-200 hover:bg-red-50' :
                          facility.type === 'EMERGENCY_EXIT' ? 'text-orange-700 border-orange-200 hover:bg-orange-50' :
                          facility.type === 'FIRST_AID' ? 'text-blue-700 border-blue-200 hover:bg-blue-50' :
                          'text-green-700 border-green-200 hover:bg-green-50'
                        }`}
                      >
                        {facility.type === 'FIRE_EXTINGUISHER' && <AlertTriangle className="mr-2 h-4 w-4" />}
                        {facility.type === 'AED' && <Heart className="mr-2 h-4 w-4" />}
                        {facility.type === 'EMERGENCY_EXIT' && <ArrowLeft className="mr-2 h-4 w-4" />}
                        {facility.type === 'FIRST_AID' && <CheckCircle className="mr-2 h-4 w-4" />}
                        {facility.type === 'OTHER' && <MapPin className="mr-2 h-4 w-4" />}
                        {facility.name} ({facility.location})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                          {facility.name} 위치도
                        </DialogTitle>
                      </DialogHeader>
                      <div className="mt-4">
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">위치:</span> {facility.location}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">시설유형:</span> {
                              facility.type === 'FIRE_EXTINGUISHER' ? '소화기' :
                              facility.type === 'AED' ? '자동심장충격기' :
                              facility.type === 'EMERGENCY_EXIT' ? '비상구' :
                              facility.type === 'FIRST_AID' ? '응급처치함' :
                              '기타'
                            }
                          </p>
                        </div>
                        {facility.imageUrl ? (
                          <img 
                            src={facility.imageUrl} 
                            alt={`${facility.name} 위치도`} 
                            className="w-full h-auto border rounded-lg shadow-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                // Clear existing content safely
                                parent.innerHTML = '';
                                
                                // Create error message container
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'text-center py-8 text-gray-500';
                                
                                // Create and add icon placeholder (note: actual icon needs React component)
                                const iconDiv = document.createElement('div');
                                iconDiv.className = 'mx-auto h-12 w-12 text-gray-300 mb-2';
                                iconDiv.textContent = '📍'; // Simple emoji fallback for MapPin icon
                                
                                // Create error message
                                const errorMsg = document.createElement('p');
                                errorMsg.textContent = '이미지를 불러올 수 없습니다';
                                
                                // Create URL display (safely using textContent)
                                const urlMsg = document.createElement('p');
                                urlMsg.className = 'text-xs mt-1';
                                urlMsg.textContent = facility.imageUrl || '';
                                
                                // Append all elements
                                errorDiv.appendChild(iconDiv);
                                errorDiv.appendChild(errorMsg);
                                errorDiv.appendChild(urlMsg);
                                parent.appendChild(errorDiv);
                              }
                            }}
                          />
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <MapPin className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                            <p>위치 이미지가 등록되지 않았습니다</p>
                          </div>
                        )}
                        
                        {/* 안전시설 사용방법 안내 */}
                        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-l-4 border-blue-400">
                          <h3 className="font-bold text-blue-900 mb-3 flex items-center">
                            <AlertTriangle className="mr-2 h-5 w-5 text-blue-600" />
                            {
                              facility.type === 'FIRE_EXTINGUISHER' ? '소화기 사용방법' :
                              facility.type === 'AED' ? 'AED(자동심장충격기) 사용방법' :
                              facility.type === 'EMERGENCY_EXIT' ? '비상구 이용방법' :
                              facility.type === 'FIRST_AID' ? '응급처치함 사용방법' :
                              '안전시설 이용 안내'
                            }
                          </h3>
                          
                          {facility.type === 'FIRE_EXTINGUISHER' && (
                            <div className="text-sm text-blue-800 space-y-2">
                              <div className="bg-white p-3 rounded border-l-4 border-red-400">
                                <p className="font-bold text-red-700 mb-2">🔥 PASS 4단계 사용법</p>
                                <ul className="space-y-1">
                                  <li><strong>P (Pull):</strong> 안전핀을 뽑는다</li>
                                  <li><strong>A (Aim):</strong> 호스를 불씨 아래 부분으로 향한다</li>
                                  <li><strong>S (Squeeze):</strong> 손잡이를 꽉 쥔다</li>
                                  <li><strong>S (Sweep):</strong> 좌우로 골고루 분사한다</li>
                                </ul>
                                <p className="mt-2 text-red-600 font-medium">※ 바람을 등지고 2-3m 거리에서 사용</p>
                              </div>
                            </div>
                          )}
                          
                          {facility.type === 'AED' && (
                            <div className="text-sm text-blue-800 space-y-2">
                              <div className="bg-white p-3 rounded border-l-4 border-red-400">
                                <p className="font-bold text-red-700 mb-2">❤️ AED 사용 5단계</p>
                                <ol className="space-y-1 list-decimal list-inside">
                                  <li>전원 켜기 (뚜껑 열기 또는 전원 버튼)</li>
                                  <li>패드 부착 (오른쪽 가슴 위, 왼쪽 겨드랑이 아래)</li>
                                  <li>심장리듬 분석 (모든 사람 떨어지세요!)</li>
                                  <li>충격 버튼 누르기 (필요시 음성 안내에 따라)</li>
                                  <li>심폐소생술 실시 (30회 가슴압박, 2회 인공호흡)</li>
                                </ol>
                                <p className="mt-2 text-red-600 font-medium">※ 119 신고 후 구급차 도착까지 계속 실시</p>
                              </div>
                            </div>
                          )}
                          
                          {facility.type === 'EMERGENCY_EXIT' && (
                            <div className="text-sm text-blue-800 space-y-2">
                              <div className="bg-white p-3 rounded border-l-4 border-orange-400">
                                <p className="font-bold text-orange-700 mb-2">🚪 비상구 이용수칙</p>
                                <ul className="space-y-1">
                                  <li>• 평상시 비상구 위치와 경로를 숙지해두세요</li>
                                  <li>• 비상시에는 엘리베이터 사용을 금지합니다</li>
                                  <li>• 낮은 자세로 벽을 따라 이동하세요</li>
                                  <li>• 연기가 있을 때는 코와 입을 막고 이동</li>
                                  <li>• 비상구 앞에 물건을 쌓아두지 마세요</li>
                                </ul>
                                <p className="mt-2 text-orange-600 font-medium">※ 침착하게 질서를 지켜 대피하세요</p>
                              </div>
                            </div>
                          )}
                          
                          {facility.type === 'FIRST_AID' && (
                            <div className="text-sm text-blue-800 space-y-2">
                              <div className="bg-white p-3 rounded border-l-4 border-green-400">
                                <p className="font-bold text-green-700 mb-2">🏥 응급처치함 사용법</p>
                                <ul className="space-y-1">
                                  <li>• <strong>외상:</strong> 거즈, 밴드, 붕대로 지혈 및 보호</li>
                                  <li>• <strong>화상:</strong> 차가운 물로 식힌 후 화상연고 도포</li>
                                  <li>• <strong>베인 상처:</strong> 소독약으로 소독 후 밴드 부착</li>
                                  <li>• <strong>삐끗함:</strong> 냉찜질팩으로 부기 완화</li>
                                  <li>• 사용 후에는 보충이 필요한 용품을 신고하세요</li>
                                </ul>
                                <p className="mt-2 text-green-600 font-medium">※ 심각한 상처는 즉시 119 신고</p>
                              </div>
                            </div>
                          )}
                          
                          {facility.type === 'OTHER' && (
                            <div className="text-sm text-blue-800 space-y-2">
                              <div className="bg-white p-3 rounded border-l-4 border-blue-400">
                                <p className="font-bold text-blue-700 mb-2">⚠️ 안전시설 이용 안내</p>
                                <ul className="space-y-1">
                                  <li>• 시설 사용 전 작동 상태를 확인하세요</li>
                                  <li>• 정기적인 점검과 관리가 필요합니다</li>
                                  <li>• 고장 발견 시 즉시 관리자에게 신고하세요</li>
                                  <li>• 비상시에만 사용하고 평상시 훼손 금지</li>
                                  <li>• 사용법을 모를 때는 전문가의 도움을 받으세요</li>
                                </ul>
                                <p className="mt-2 text-blue-600 font-medium">※ 생명과 직결된 중요한 시설입니다</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-400">
                  <MapPin className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-600">등록된 안전시설이 없습니다.</p>
                  <p className="text-xs text-gray-500 mt-1">
                    설비 편집에서 안전시설을 추가해주세요.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accident History */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <History className="mr-3 h-6 w-6 text-orange-600" />
              사고이력
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incidents && incidents.length > 0 ? (
              <div className="space-y-3">
                {(incidents as Incident[]).slice(0, 3).map((incident) => (
                  <div 
                    key={incident.id} 
                    className={`rounded-lg p-4 border-l-4 hover:shadow-md transition-all duration-200 ${
                      incident.severity === 'HIGH' 
                        ? 'bg-red-50 border-red-400 hover:bg-red-100' 
                        : incident.severity === 'MEDIUM' 
                        ? 'bg-orange-50 border-orange-400 hover:bg-orange-100' 
                        : 'bg-yellow-50 border-yellow-400 hover:bg-yellow-100'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <RiskLevelBadge level={incident.severity} />
                      <span className="text-xs text-gray-500">
                        {new Date(incident.incidentDate).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {incident.description}
                    </p>
                    {incident.actionsTaken && (
                      <p className="text-xs text-gray-600">
                        조치사항: {incident.actionsTaken}
                      </p>
                    )}
                  </div>
                ))}
                {incidents.length > 3 && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    최근 3건의 사고이력을 표시합니다.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-400">
                  <p className="text-sm text-gray-600">등록된 사고이력이 없습니다.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contacts */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <Phone className="mr-3 h-6 w-6 text-red-600" />
              비상연락처
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(equipment.emergencyContacts) && equipment.emergencyContacts.length > 0 ? (
              <div className="space-y-4">
                {equipment.emergencyContacts.map((contact: any, index: any) => (
                  <div key={index} className="p-4 bg-red-50 rounded-lg border-l-4 border-red-400 hover:bg-red-100 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-red-800">
                          {contact.role || contact.name || (typeof contact === 'string' ? contact : '연락처')}
                        </div>
                        {contact.name && contact.role && (
                          <div className="text-sm text-red-600">{contact.name}</div>
                        )}
                        {(contact.phone || contact.contact) && (
                          <div className="text-sm text-red-600">{contact.phone || contact.contact}</div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-all duration-200 hover:scale-105"
                        onClick={() => window.open(`tel:${contact.phone || contact.contact || (typeof contact === 'string' ? contact : '')}`, '_self')}
                        disabled={!contact.phone && !contact.contact && typeof contact !== 'string'}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        통화
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-400">
                  <p className="text-sm text-gray-600">등록된 비상연락처가 없습니다.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Voice Summary */}
        <Card className="card-minimal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900 text-lg">
              <Volume2 className="mr-3 h-6 w-6 text-blue-600" />
              AI 요약 음성재생
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                이 설비의 안전 정보를 AI가 음성으로 요약해 드립니다.
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={handlePlayVoiceGuide}
                  disabled={!voiceGuide?.guide || isGeneratingVoice || (isPlayingGuide && !isPaused)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
                >
                  {isGeneratingVoice ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      음성 생성중...
                    </>
                  ) : isPaused ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      재생
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 mr-2" />
                      음성 재생
                    </>
                  )}
                </Button>
                
                {(isPlayingGuide || isGeneratingVoice) && (
                  <>
                    <Button 
                      onClick={handlePauseVoiceGuide}
                      disabled={isPaused || isGeneratingVoice}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white disabled:bg-gray-400"
                    >
                      <Pause className="w-4 h-4" />
                    </Button>
                    
                    <Button 
                      onClick={handleStopVoiceGuide}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
