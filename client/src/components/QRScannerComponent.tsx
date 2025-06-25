import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Camera, AlertCircle } from "lucide-react";
import { BrowserQRCodeReader } from "@zxing/library";

interface QRScannerComponentProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QRScannerComponent({ onScan, onClose }: QRScannerComponentProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    startCamera();
    
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError("");
      setIsScanning(true);
      
      // Try environment camera first, fallback to user camera
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment", // Use back camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (envError) {
        console.log("Environment camera not available, trying user camera");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "user", // Use front camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      }
      
      streamRef.current = stream;
      setHasPermission(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready before starting scanning
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              console.log("Video started playing");
              // Start QR code scanning after video is playing
              setTimeout(() => startQRScanning(), 500);
            }).catch((err) => {
              console.error("Video play error:", err);
            });
          }
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setHasPermission(false);
      setError("카메라에 접근할 수 없습니다. 권한을 확인해주세요.");
      setIsScanning(false);
    }
  };

  const startQRScanning = async () => {
    if (!videoRef.current) return;
    
    try {
      const codeReader = new BrowserQRCodeReader();
      codeReaderRef.current = codeReader;
      
      // Start continuous scanning
      await codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result) {
          console.log("QR Code detected:", result.getText());
          onScan(result.getText());
          stopCamera();
        }
        
        if (error && !(error.name === 'NotFoundException')) {
          console.error("QR scanning error:", error);
        }
      });
    } catch (err) {
      console.error("QR scanner initialization error:", err);
    }
  };

  const stopCamera = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleManualInput = () => {
    const code = prompt("QR 코드를 직접 입력하세요:");
    if (code && code.trim()) {
      onScan(code.trim());
    }
  };

  // Demo QR code for testing
  const simulateQRScan = () => {
    onScan("COMP-A-101");
  };

  return (
    <Card className="w-full max-w-md mx-auto material-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">QR 코드 스캔</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {hasPermission === null && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">카메라를 초기화하는 중...</p>
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
            <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
                style={{ transform: 'scaleX(-1)' }}
              />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg animate-pulse">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-primary"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-primary"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-primary"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-primary"></div>
                </div>
              </div>
              
              {/* Status indicator */}
              <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {isScanning ? "스캔 중..." : "대기 중"}
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                QR 코드를 카메라 프레임 안에 맞춰주세요
              </p>
              
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={handleManualInput}
                  className="w-full"
                >
                  수동 코드 입력
                </Button>
                
                <Button 
                  onClick={simulateQRScan}
                  variant="ghost"
                  className="w-full text-sm text-gray-500"
                >
                  데모: 샘플 장비 스캔
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
