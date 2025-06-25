import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, X } from 'lucide-react';

interface WorkingQRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function WorkingQRScanner({ onScan, onClose }: WorkingQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError("카메라 접근이 거부되었습니다.");
      }
    };
    
    startCamera();
    
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleManualInput = () => {
    const code = prompt("QR 코드를 직접 입력하세요 (예: COMP-A-101):");
    if (code && code.trim()) {
      onScan(code.trim());
    }
  };

  const handleQuickTest = () => {
    onScan("COMP-A-101");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">QR 코드 스캔</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {error ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={handleManualInput} className="w-full">
              수동 입력
            </Button>
          </div>
        ) : (
          <>
            <div style={{ width: '100%', height: '300px', backgroundColor: 'black', position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                width="100%"
                height="100%"
                style={{ 
                  objectFit: 'cover',
                  backgroundColor: 'black'
                }}
              />
              
              {/* Scanning overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  border: '2px dashed white',
                  borderRadius: '8px',
                  position: 'relative',
                  animation: 'pulse 2s infinite'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-2px',
                    left: '-2px',
                    width: '16px',
                    height: '16px',
                    borderTop: '2px solid #60a5fa',
                    borderLeft: '2px solid #60a5fa'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '16px',
                    height: '16px',
                    borderTop: '2px solid #60a5fa',
                    borderRight: '2px solid #60a5fa'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    left: '-2px',
                    width: '16px',
                    height: '16px',
                    borderBottom: '2px solid #60a5fa',
                    borderLeft: '2px solid #60a5fa'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '16px',
                    height: '16px',
                    borderBottom: '2px solid #60a5fa',
                    borderRight: '2px solid #60a5fa'
                  }}></div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 mt-4">
              <div className="flex gap-2">
                <Button onClick={handleManualInput} variant="outline" className="flex-1">
                  수동 입력
                </Button>
                <Button onClick={onClose} variant="secondary" className="flex-1">
                  취소
                </Button>
              </div>
              
              <Button onClick={handleQuickTest} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                테스트: 압축기 A-101
              </Button>
            </div>
            
            <div className="text-center text-sm text-gray-600 mt-4">
              <p>QR 코드를 화면에 맞춰주세요</p>
              <p className="mt-1">또는 아래 버튼으로 테스트하세요</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}