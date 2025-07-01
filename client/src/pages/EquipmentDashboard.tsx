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

import fireExtinguisherImage from "@assets/Fire Extinguisher Emergency Escape Route_1750839863344.jpg";
import aedImage from "@assets/AED_1750839869531.png";
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
  CheckCircle
} from "lucide-react";
import type { Incident } from "@shared/schema";

export default function EquipmentDashboard() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [isPlayingGuide, setIsPlayingGuide] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [showSafetyDevices, setShowSafetyDevices] = useState(false);
  const [showFireExtinguisher, setShowFireExtinguisher] = useState(false);
  const [showAED, setShowAED] = useState(false);
  
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
    <div className="pb-20 fade-in min-h-screen">
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
              <span className="text-gray-700 font-medium">전체 위험도</span>
              <RiskLevelBadge level={equipment.riskLevel} />
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div className="p-5 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border border-red-200/50 shadow-md">
                <div className="text-3xl font-bold text-red-600 mb-1">{riskCounts.high}</div>
                <div className="text-sm text-red-700 font-medium">고위험</div>
              </div>
              <div className="p-5 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl border border-yellow-200/50 shadow-md">
                <div className="text-3xl font-bold text-yellow-600 mb-1">{riskCounts.medium}</div>
                <div className="text-sm text-yellow-700 font-medium">중위험</div>
              </div>
              <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border border-green-200/50 shadow-md">
                <div className="text-3xl font-bold text-green-600 mb-1">{riskCounts.low}</div>
                <div className="text-sm text-green-700 font-medium">저위험</div>
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
            <div className="grid grid-cols-2 gap-6">
              {equipment.riskFactors?.highTemperature && (
                <Card className="card-minimal card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-center mb-3">
                      <span className="material-icons text-red-600 mr-3 text-2xl">whatshot</span>
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
                  <CardContent className="p-5">
                    <div className="flex items-center mb-3">
                      <span className="material-icons text-orange-600 mr-3 text-2xl">compress</span>
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
                  <CardContent className="p-5">
                    <div className="flex items-center mb-3">
                      <span className="material-icons text-yellow-600 mr-3 text-2xl">electrical_services</span>
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
                  <CardContent className="p-5">
                    <div className="flex items-center mb-3">
                      <span className="material-icons text-purple-600 mr-3 text-2xl">height</span>
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
                  <CardContent className="p-5">
                    <div className="flex items-center mb-3">
                      <span className="material-icons text-gray-600 mr-3 text-2xl">fitness_center</span>
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
                            <img 
                              src={equipment.msdsImageUrl} 
                              alt={`${equipment.hazardousChemicalName} MSDS 정보`} 
                              className="w-full h-auto border rounded-lg shadow-sm"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-msds.png";
                              }}
                            />
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
            <div className="grid grid-cols-1 gap-3">
              {/* Fire Extinguisher & Emergency Escape Route */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full text-green-700 border-green-200 hover:bg-green-50"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    소화기 & 비상대피로 위치
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                      소화기 & 비상대피로 위치도
                    </DialogTitle>
                  </DialogHeader>
                  <div className="mt-4">
                    <img 
                      src={fireExtinguisherImage} 
                      alt="소화기 및 비상대피로 위치도" 
                      className="w-full h-auto border rounded-lg shadow-sm"
                    />
                  </div>
                </DialogContent>
              </Dialog>

              {/* AED Location */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full text-red-700 border-red-200 hover:bg-red-50"
                  >
                    <Heart className="mr-2 h-4 w-4" />
                    AED(자동심장충격기) 위치
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                      AED(자동심장충격기) 위치도
                    </DialogTitle>
                  </DialogHeader>
                  <div className="mt-4">
                    <img 
                      src={aedImage} 
                      alt="AED 위치도" 
                      className="w-full h-auto border rounded-lg shadow-sm"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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
                        <div className="font-semibold text-red-800">{contact.role || contact.name || contact}</div>
                        {contact.name && contact.role && (
                          <div className="text-sm text-red-600">{contact.name}</div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-all duration-200 hover:scale-105"
                        onClick={() => window.open(`tel:${contact.phone || contact}`, '_self')}
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
      </div>
    </div>
  );
}
