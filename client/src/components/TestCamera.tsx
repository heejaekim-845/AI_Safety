import React, { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface TestCameraProps {
  onClose: () => void;
}

export default function TestCamera({ onClose }: TestCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera error:', err);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Camera Test</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div style={{ width: '100%', height: '300px', backgroundColor: 'black', border: '2px solid red' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            width="100%"
            height="100%"
            style={{ 
              objectFit: 'cover',
              backgroundColor: 'blue',
              border: '2px solid green'
            }}
          />
        </div>
        
        <Button onClick={onClose} className="w-full mt-4">
          Close
        </Button>
      </div>
    </div>
  );
}