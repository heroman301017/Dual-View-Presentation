
import React, { useEffect, useRef, useState } from 'react';
import { CameraIcon, MicOff, VideoOff } from './icons';

interface CameraViewProps {
  isMirrored: boolean;
  onStreamReady: (stream: MediaStream | null) => void;
  filterClassName: string;
}

export const CameraView: React.FC<CameraViewProps> = ({ isMirrored, onStreamReady, filterClassName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getMedia = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        onStreamReady(stream);
      } catch (err) {
        console.error("Error accessing media devices.", err);
        setError("Camera and microphone access denied. Please enable permissions in your browser settings.");
        onStreamReady(null);
      }
    };

    getMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      onStreamReady(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-center p-4">
        <VideoOff className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Device Error</h2>
        <p className="text-gray-400 max-w-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-all duration-300 ${isMirrored ? 'scale-x-[-1]' : ''} ${filterClassName}`}
      ></video>
       <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-20">
          <p className="text-lg font-semibold">Self-Monitoring View</p>
        </div>
    </div>
  );
};