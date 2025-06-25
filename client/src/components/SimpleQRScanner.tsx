import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, X } from 'lucide-react';

interface SimpleQRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function SimpleQRScanner({ onScan, onClose }: SimpleQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      setError("");
      setIsScanning(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      
      setHasPermission(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setHasPermission(false);
      setError("카메라 접근이 거부되었습니다.");
      setIsScanning(false);
    }
  };

  const handleManualInput = () => {
    const code = prompt("QR 코드를 직접 입력하세요:");
    if (code) {
      onScan(code);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">QR 코드 스캔</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4">
          {hasPermission === null && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>카메라 권한을 요청 중...</p>
            </div>
          )}

          {hasPermission === false && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <div className="space-y-2">
                <Button onClick={startCamera} className="w-full">
                  다시 시도
                </Button>
                <Button variant="outline" onClick={handleManualInput} className="w-full">
                  수동 입력
                </Button>
              </div>
            </div>
          )}

          {hasPermission === true && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg" style={{ height: '300px' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
                
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg animate-pulse">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-blue-400"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-blue-400"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-blue-400"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-blue-400"></div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleManualInput} variant="outline" className="flex-1">
                  수동 코드 입력
                </Button>
                <Button onClick={onClose} variant="secondary" className="flex-1">
                  취소
                </Button>
              </div>
              
              <div className="text-center text-sm text-gray-600">
                <p>QR 코드를 화면 중앙에 맞춰주세요</p>
                <p className="mt-1">테스트: "COMP-A-101"</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}