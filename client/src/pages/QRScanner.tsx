import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEquipment } from "@/hooks/useEquipment";
import CameraScanner from "@/components/CameraScanner";
import RiskLevelBadge from "@/components/RiskLevelBadge";
import { Search, Camera, ChevronRight } from "lucide-react";

export default function QRScanner() {
  const [, setLocation] = useLocation();
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: equipment, isLoading } = useEquipment();

  const handleEquipmentSelect = (equipmentId: number) => {
    setLocation(`/equipment/${equipmentId}`);
  };

  const handleQRScan = (code: string) => {
    // Try to find equipment by code
    const foundEquipment = equipment?.find(eq => eq.code === code);
    if (foundEquipment) {
      handleEquipmentSelect(foundEquipment.id);
    } else {
      alert("해당 QR 코드의 설비를 찾을 수 없습니다.");
    }
    setShowScanner(false);
  };

  const filteredEquipment = equipment?.filter(eq => 
    eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.location.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
      <div className="text-center mb-6">
        <h2 className="text-xl font-medium text-gray-900 mb-2">설비 인식</h2>
        <p className="text-gray-600">QR 코드를 스캔하거나 설비를 직접 선택하세요</p>
      </div>
      
      {/* QR Scanner Interface */}
      {showScanner ? (
        <CameraScanner 
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      ) : (
        <div className="bg-gray-100 rounded-lg p-8 mb-6 text-center">
          <Camera size={64} className="text-primary mx-auto mb-4" />
          <p className="text-gray-600 mb-4">카메라로 QR 코드를 스캔하세요</p>
          <Button 
            onClick={() => setShowScanner(true)}
            className="bg-primary hover:bg-primary/90 text-white font-medium material-shadow"
          >
            <Camera className="mr-2 h-4 w-4" />
            QR 스캔 시작
          </Button>
        </div>
      )}
      
      {/* Manual Equipment Selection */}
      <div className="border-t pt-6">
        <h3 className="font-medium text-gray-900 mb-4">또는 설비 직접 선택</h3>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="설비명, 코드, 위치로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-3">
          {filteredEquipment.map((eq) => (
            <Card 
              key={eq.id}
              className="cursor-pointer hover:bg-gray-50 transition-colors material-shadow-sm"
              onClick={() => handleEquipmentSelect(eq.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{eq.name}</h4>
                    <p className="text-sm text-gray-600 mb-1">{eq.location}</p>
                    <p className="text-xs text-gray-500 mb-2">{eq.code}</p>
                    <RiskLevelBadge level={eq.riskLevel} />
                  </div>
                  <ChevronRight className="text-gray-400 h-5 w-5 mt-1" />
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
    </div>
  );
}
