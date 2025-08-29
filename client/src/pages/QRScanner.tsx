import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEquipment } from "@/hooks/useEquipment";
import WorkingQRScanner from "@/components/WorkingQRScanner";
import RiskLevelBadge from "@/components/RiskLevelBadge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Search, Camera, ChevronRight, Clock, Calendar, Cloud, Sun, CloudRain, Snowflake, CloudDrizzle, Zap } from "lucide-react";

export default function QRScanner() {
  const [, setLocation] = useLocation();
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userLocation, setUserLocation] = useState<string>("서울"); // Default fallback
  const [locationStatus, setLocationStatus] = useState<"loading" | "success" | "error">("loading");
  const { data: equipment, isLoading } = useEquipment();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get user's current location
  useEffect(() => {
    const getCurrentLocation = () => {
      if (!navigator.geolocation) {
        console.log("Geolocation is not supported by this browser.");
        setLocationStatus("error");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            console.log(`GPS coordinates: ${latitude}, ${longitude}`);
            
            // 좌표를 서버로 전달해서 날씨 정보 가져오기
            const response = await apiRequest("POST", "/api/weather/current-coords", { 
              lat: latitude, 
              lon: longitude 
            });
            
            const weatherData = await response.json();
            setUserLocation(weatherData.location);
            setLocationStatus("success");
            console.log(`Location detected: ${weatherData.location}`);
          } catch (error) {
            console.error("Error getting location name:", error);
            setLocationStatus("error");
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationStatus("error");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes cache
        }
      );
    };

    getCurrentLocation();
  }, []);

  // Fetch current weather based on user location
  const { data: weatherData } = useQuery({
    queryKey: ['/api/weather/current', userLocation],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/weather/current", { location: userLocation });
      return response.json();
    },
    refetchInterval: 600000, // Refresh every 10 minutes
    enabled: !!userLocation && locationStatus === "success",
  });

  const handleEquipmentSelect = (equipmentId: number) => {
    setLocation(`/equipment/${equipmentId}`);
  };

  const handleQRScan = (code: string) => {
    // Try to find equipment by code
    const foundEquipment = equipmentArray.find((eq) => eq.code === code);
    if (foundEquipment) {
      handleEquipmentSelect(foundEquipment.id);
    } else {
      alert("해당 QR 코드의 설비를 찾을 수 없습니다.");
    }
    setShowScanner(false);
  };

  const equipmentArray = Array.isArray(equipment) ? equipment : [];
  const filteredEquipment = equipmentArray.filter((eq) => 
    eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date and time
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 안전 위험도 계산 함수
  const calculateSafetyRisk = (temperature: number, humidity: number) => {
    // 체감온도 계산 (Heat Index)
    const heatIndex = temperature + 0.5 * (temperature - 14.5) * (humidity / 100);
    
    // WBGT 간이 계산 (실제로는 더 복잡하지만 근사치)
    const wbgt = 0.7 * temperature + 0.2 * (temperature * humidity / 100) + 0.1 * temperature;
    
    let riskLevel = "낮음";
    let riskColor = "bg-green-600";
    let riskIcon = "✅";
    let workRecommendation = "정상 작업 가능";
    
    if (wbgt >= 31) {
      riskLevel = "위험";
      riskColor = "bg-red-600";
      riskIcon = "🚨";
      workRecommendation = "작업 중단 권장";
    } else if (wbgt >= 28) {
      riskLevel = "경고";
      riskColor = "bg-orange-500";
      riskIcon = "⚠️";
      workRecommendation = "작업 30분/휴식 30분";
    } else if (wbgt >= 25) {
      riskLevel = "주의";
      riskColor = "bg-yellow-500";
      riskIcon = "⚡";
      workRecommendation = "작업 45분/휴식 15분";
    }
    
    return {
      level: riskLevel,
      color: riskColor,
      icon: riskIcon,
      heatIndex: Math.round(heatIndex),
      wbgt: Math.round(wbgt),
      workRecommendation
    };
  };

  // Get weather icon based on condition with animations and colorful styling
  const getWeatherIcon = (condition: string) => {
    switch (condition?.toLowerCase()) {
      case 'clear':
      case '맑음':
        return (
          <div className="relative">
            <Sun className="h-8 w-8 text-yellow-400 animate-spin" style={{ 
              animation: 'spin 8s linear infinite',
              filter: 'drop-shadow(0 0 8px rgba(252, 211, 77, 0.5))'
            }} />
          </div>
        );
      case 'clouds':
      case '구름':
      case '흐림':
        return (
          <div className="relative">
            <Cloud className="h-8 w-8 animate-pulse" style={{ 
              background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 50%, #475569 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(71, 85, 105, 0.3))'
            }} />
          </div>
        );
      case 'rain':
      case '비':
        return (
          <div className="relative">
            <CloudRain className="h-8 w-8 animate-bounce" style={{ 
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e40af 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.4))',
              animation: 'bounce 1.5s infinite'
            }} />
          </div>
        );
      case 'drizzle':
      case '이슬비':
        return (
          <div className="relative">
            <CloudDrizzle className="h-8 w-8" style={{ 
              background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 4px rgba(96, 165, 250, 0.3))',
              animation: 'pulse 2s infinite'
            }} />
          </div>
        );
      case 'snow':
      case '눈':
        return (
          <div className="relative">
            <Snowflake className="h-8 w-8" style={{ 
              background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 8px rgba(199, 210, 254, 0.6))',
              animation: 'spin 3s linear infinite'
            }} />
          </div>
        );
      case 'thunderstorm':
      case '천둥번개':
        return (
          <div className="relative">
            <Zap className="h-8 w-8" style={{ 
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.7))',
              animation: 'flash 0.8s infinite alternate'
            }} />
          </div>
        );
      default:
        return (
          <div className="relative">
            <Cloud className="h-8 w-8 text-gray-400 animate-pulse" style={{ 
              filter: 'drop-shadow(0 2px 4px rgba(156, 163, 175, 0.3))'
            }} />
          </div>
        );
    }
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
    <div className="p-4 pb-20 fade-in min-h-screen">
      {/* 경보 우선 스트립 */}
      <Card className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* 좌측: 날씨·시간 정보 */}
            <div className="text-left">
              {weatherData ? (
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    {getWeatherIcon(weatherData.condition)}
                    <div className="text-sm" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
                      <span className="font-bold text-gray-900">{weatherData.condition} {weatherData.temperature}°C</span>
                      <span className="text-gray-600 ml-2">풍속 {weatherData.windSpeed}m/s</span>
                      {weatherData.rainfall > 0 && (
                        <span className="text-blue-600 ml-2">강우량 {weatherData.rainfall}mm</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
                    <p>{weatherData.location}</p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
                  날씨 정보 로딩중...
                </div>
              )}
              
              {/* 날짜/시간 */}
              <div className="text-left mt-2 pt-2 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-900" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
                  {currentTime.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short'
                  })} {formatTime(currentTime)}
                </p>
              </div>
            </div>

            {/* 우측: 안전 위험도 배지 */}
            {weatherData ? (
              <div className="text-right">
                {(() => {
                  const safetyRisk = calculateSafetyRisk(weatherData.temperature, weatherData.humidity);
                  return (
                    <>
                      <div className={`${safetyRisk.color} text-white px-3 py-2 rounded-lg shadow-md`}>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg">{safetyRisk.icon}</span>
                          <div>
                            <p className="text-sm font-bold" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
                              오늘 위험수준: {safetyRisk.level}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
                          {safetyRisk.workRecommendation}
                        </p>
                      </div>
                      <div className="text-xs text-gray-600 mt-2 text-right" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
                        <p>체감 {safetyRisk.heatIndex}°C, WBGT {safetyRisk.wbgt}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="bg-gray-400 text-white px-3 py-2 rounded-lg flex items-center space-x-2">
                  <Cloud className="h-5 w-5 animate-pulse" />
                  <span className="text-sm" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>로딩중...</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-center mb-4">
        <div className="floating">
          <img 
            src="/attached_assets/d38a3897-2e42-47b1-9feb-3970364f22e1_1751375612245.jpg" 
            alt="QR Scanner" 
            className="mx-auto mb-4"
            style={{ width: '128px', height: '182px' }}
          />
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
            className="bg-blue-600 hover:bg-blue-700 hover:shadow-xl text-white font-medium px-8 py-3 rounded-xl transition-all duration-300"
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
                      <h4 className="font-semibold text-gray-900 mb-2 text-lg break-words leading-tight">
                        {eq.name}
                      </h4>
                      <div className="flex items-center space-x-2 mb-2 text-sm text-gray-600">
                        <span className="break-words">{eq.code}</span>
                        <span className="text-gray-400">/</span>
                        <span className="break-words">{eq.location}</span>
                      </div>
                      <RiskLevelBadge level={eq.riskLevel || "MEDIUM"} />
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
