import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEquipment } from "@/hooks/useEquipment";
import WorkingQRScanner from "@/components/WorkingQRScanner";
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
    <div className="p-4 pb-20 fade-in min-h-screen">
      <div className="text-center mb-4">
        <div className="floating">
          <div className="w-16 h-16 mx-auto mb-4 safety-gradient rounded-2xl flex items-center justify-center">
            <Search className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">설비 인식</h2>
        <p className="text-gray-600">QR 코드를 스캔하거나 설비를 직접 선택하세요</p>
      </div>
      
      {/* QR Scanner Interface */}
      {showScanner ? (
        <WorkingQRScanner 
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      ) : (
        <div className="card-minimal p-4 mb-4 text-center card-hover">
          <div className="w-16 h-16 mx-auto mb-3 glass-effect flex items-center justify-center">
            <Camera size={32} className="text-blue-600" />
          </div>
          <p className="text-gray-600 mb-4 text-base">카메라로 QR 코드를 스캔하세요</p>
          <Button 
            onClick={() => setShowScanner(true)}
            className="safety-gradient hover:shadow-xl text-white font-medium px-8 py-3 rounded-xl transition-all duration-300"
          >
            <Camera className="mr-2 h-5 w-5" />
            QR 스캔 시작
          </Button>
        </div>
      )}
      
      {/* Manual Equipment Selection */}
      <div className="border-t border-gray-200/50 pt-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">또는 설비 직접 선택</h3>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            placeholder="설비명, 코드, 위치로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-4 py-3 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
          />
        </div>

        <div className="space-y-2">
          {filteredEquipment.map((eq) => (
            <Card 
              key={eq.id}
              className="card-minimal cursor-pointer card-hover"
              onClick={() => handleEquipmentSelect(eq.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-5 flex-1">
                    {/* Equipment Thumbnail */}
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-md">
                      {eq.imageUrl ? (
                        <img 
                          src={eq.imageUrl} 
                          alt={eq.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full safety-gradient flex items-center justify-center ${eq.imageUrl ? 'hidden' : 'flex'}`}
                      >
                        <span className="text-white text-lg font-bold">
                          {eq.name.substring(0, 2)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Equipment Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-2 text-lg truncate">{eq.name}</h4>
                      <p className="text-gray-600 mb-1 truncate">{eq.location}</p>
                      <p className="text-sm text-gray-500 mb-3">{eq.code}</p>
                      <RiskLevelBadge level={eq.riskLevel} />
                    </div>
                  </div>
                  <ChevronRight className="text-gray-400 h-6 w-6 mt-1 flex-shrink-0" />
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
