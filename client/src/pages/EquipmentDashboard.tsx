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
  Equal
} from "lucide-react";
import type { Incident } from "@shared/schema";

export default function EquipmentDashboard() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [isPlayingGuide, setIsPlayingGuide] = useState(false);
  
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
      setIsPlayingGuide(true);
      const utterance = new SpeechSynthesisUtterance(voiceGuide.guide);
      utterance.lang = 'ko-KR';
      utterance.onend = () => setIsPlayingGuide(false);
      speechSynthesis.speak(utterance);
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
          <h3 className="text-xl font-medium mb-2">{equipment.name}</h3>
          <p className="text-primary-100 mb-1">CODE: {equipment.code}</p>
          <p className="text-primary-100">위치: {equipment.location}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Risk Level Visualization */}
        <Card className="material-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900">
              <AlertTriangle className="mr-2 h-5 w-5" />
              위험도 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-red-50">
                <div className="w-8 h-8 bg-danger rounded-full mx-auto mb-2"></div>
                <p className="text-xs text-danger font-medium">고위험</p>
                <p className="text-lg font-bold text-danger">{riskCounts.high}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-50">
                <div className="w-8 h-8 bg-warning rounded-full mx-auto mb-2"></div>
                <p className="text-xs text-warning font-medium">주의</p>
                <p className="text-lg font-bold text-warning">{riskCounts.medium}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50">
                <div className="w-8 h-8 bg-success rounded-full mx-auto mb-2"></div>
                <p className="text-xs text-success font-medium">안전</p>
                <p className="text-lg font-bold text-success">{riskCounts.low}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipment Risk Information */}
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
                비상 연락망
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
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
                <Button 
                  onClick={handlePlayVoiceGuide}
                  disabled={isPlayingGuide}
                  className="bg-primary hover:bg-primary/90 text-white"
                  size="sm"
                >
                  <Play className="mr-1 h-4 w-4" />
                  {isPlayingGuide ? "재생 중..." : "음성 안내 시작"}
                </Button>
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
