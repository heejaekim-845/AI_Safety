import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface WorkingQRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function WorkingQRScanner({ onScan, onClose }: WorkingQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    const startQRScanning = async () => {
      try {
        setIsScanning(true);
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Start scanning
          codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
            if (result) {
              console.log('QR Code detected:', result.getText());
              onScan(result.getText());
              stopCamera();
            }
            if (err && !(err.name === 'NotFoundException')) {
              console.error('QR scanning error:', err);
            }
          });
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError("카메라 접근이 거부되었습니다.");
        setIsScanning(false);
      }
    };
    
    startQRScanning();
    
    return stopCamera;
  }, [onScan]);

  const handleManualInput = () => {
    const code = prompt("QR 코드를 직접 입력하세요 (예: COMP-A-101):");
    if (code && code.trim()) {
      onScan(code.trim());
    }
  };

  const handleQuickTest = () => {
    stopCamera();
    onScan("COMP-A-101");
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">QR 코드 스캔</h3>
          <Button variant="ghost" size="sm" onClick={handleClose}>
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
                <Button onClick={handleClose} variant="secondary" className="flex-1">
                  취소
                </Button>
              </div>
              
              <Button onClick={handleQuickTest} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                테스트: 압축기 A-101
              </Button>
            </div>
            
            <div className="text-center text-sm text-gray-600 mt-4">
              <p className={isScanning ? "text-green-600" : "text-gray-600"}>
                {isScanning ? "QR 코드 인식 중..." : "카메라 준비 중..."}
              </p>
              <p className="mt-1">QR 코드를 화면에 맞춰주세요</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}