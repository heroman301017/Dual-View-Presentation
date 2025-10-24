import React, { useEffect, useRef, useState } from 'react';
import { CameraIcon, MicOff, VideoOff } from './icons';

// Make TypeScript aware of the globally available face-detection library from index.html
declare const faceDetection: any;
declare namespace tf {
    const setBackend: (backend: string) => Promise<void>;
    const ready: () => Promise<void>;
}

type BackendType = 'webgl' | 'cpu' | 'none';

interface CameraViewProps {
  isMirrored: boolean;
  onStreamReady: (stream: MediaStream | null) => void;
  filterClassName: string;
  aiAssistantEnabled: boolean;
}

const FEEDBACK_COLORS = {
  good: '#22c55e', // green-500
  warn: '#eab308', // yellow-500
  bad: '#ef4444',   // red-500
  neutral: '#6b7280' // gray-500
};
const SWEET_SPOT_COLOR = 'rgba(255, 255, 255, 0.5)';

export const CameraView: React.FC<CameraViewProps> = ({ isMirrored, onStreamReady, filterClassName, aiAssistantEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detector, setDetector] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; color: string; showGuide: boolean }>({ message: '', color: FEEDBACK_COLORS.neutral, showGuide: false });
  const [backendInUse, setBackendInUse] = useState<BackendType>('none');


  // Effect to load the AI model
  useEffect(() => {
    const loadModel = async (retries = 10) => {
      // Check if the global libraries are loaded from the CDN
      if (typeof tf === 'undefined' || typeof faceDetection === 'undefined') {
        if (retries > 0) {
          setTimeout(() => loadModel(retries - 1), 200); // Wait 200ms and retry
          return;
        }
        console.error("TensorFlow.js or face-detection model not loaded in time.");
        setError("Could not load AI libraries. Please check your internet connection and refresh.");
        return;
      }

      try {
        await tf.setBackend('webgl');
        await tf.ready();
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detectorConfig = {
          runtime: 'tfjs',
        };
        const createdDetector = await faceDetection.createDetector(model, detectorConfig);
        setDetector(createdDetector);
        setBackendInUse('webgl');
      } catch (err) {
        console.warn("WebGL backend failed, trying CPU backend as a fallback...", err);
        try {
          await tf.setBackend('cpu');
          await tf.ready();
          const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
          const detectorConfig = {
            runtime: 'tfjs',
          };
          const createdDetector = await faceDetection.createDetector(model, detectorConfig);
          setDetector(createdDetector);
          setBackendInUse('cpu');
        } catch (cpuErr) {
          console.error("CPU backend also failed.", cpuErr);
          setError("Could not load AI Assistant model. Your browser or device might not be supported.");
          setBackendInUse('none');
        }
      }
    };
    loadModel();
  }, []);

  // Effect for the main detection loop
  useEffect(() => {
    const detectFace = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || !detector || !canvasRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(detectFace);
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Define the "sweet spot" for ideal framing
        const sweetSpotWidth = canvas.width * 0.35;
        const sweetSpotHeight = canvas.height * 0.5;
        const sweetSpotX = (canvas.width - sweetSpotWidth) / 2;
        const sweetSpotY = (canvas.height - sweetSpotHeight) / 2;
        const sweetSpot = { x: sweetSpotX, y: sweetSpotY, width: sweetSpotWidth, height: sweetSpotHeight };

        const faces = await detector.estimateFaces(video, { flipHorizontal: false });

        if (faces.length > 0) {
            const face = faces[0].box;
            const faceCenterX = face.x + face.width / 2;
            const faceCenterY = face.y + face.height / 2;

            // --- New Feedback Logic ---
            const isHorizontallyCentered = faceCenterX > sweetSpot.x && faceCenterX < sweetSpot.x + sweetSpot.width;
            const isVerticallyCentered = faceCenterY > sweetSpot.y && faceCenterY < sweetSpot.y + sweetSpot.height;
            const faceArea = face.width * face.height;
            const sweetSpotArea = sweetSpot.width * sweetSpot.height;
            const sizeRatio = faceArea / sweetSpotArea;
            const isGoodSize = sizeRatio > 0.4 && sizeRatio < 1.2;

            let newFeedback: { message: string; color: string; showGuide: boolean };

            if (isHorizontallyCentered && isVerticallyCentered && isGoodSize) {
                newFeedback = { message: 'Perfect Framing!', color: FEEDBACK_COLORS.good, showGuide: false };
            } else {
                const messages = [];
                const horizontalDist = (faceCenterX - (sweetSpot.x + sweetSpot.width / 2)) / sweetSpot.width;
                const verticalDist = (faceCenterY - (sweetSpot.y + sweetSpot.height / 2)) / sweetSpot.height;

                if (Math.abs(horizontalDist) > 0.1) {
                    messages.push(horizontalDist > 0 ? 'Move Left' : 'Move Right');
                }
                if (Math.abs(verticalDist) > 0.1) {
                    messages.push(verticalDist > 0 ? 'Move Up' : 'Move Down');
                }
                if (!isGoodSize) {
                    messages.push(sizeRatio <= 0.4 ? 'Move Closer' : 'Move Further');
                }
                
                if (messages.length === 0) {
                    newFeedback = { message: 'Almost There!', color: FEEDBACK_COLORS.warn, showGuide: true };
                } else {
                    newFeedback = { message: messages.join(' & '), color: FEEDBACK_COLORS.bad, showGuide: true };
                }
            }
            setFeedback(newFeedback);

            // --- Drawing Logic ---
            ctx.strokeStyle = newFeedback.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(face.x, face.y, face.width, face.height);

            if (newFeedback.showGuide) {
                ctx.setLineDash([10, 10]);
                ctx.strokeStyle = SWEET_SPOT_COLOR;
                ctx.lineWidth = 2;
                ctx.strokeRect(sweetSpot.x, sweetSpot.y, sweetSpot.width, sweetSpot.height);
                ctx.setLineDash([]);
            }
        } else {
            setFeedback({ message: 'No Face Detected', color: FEEDBACK_COLORS.neutral, showGuide: true });
            // Draw guide when no face is detected
            ctx.setLineDash([10, 10]);
            ctx.strokeStyle = SWEET_SPOT_COLOR;
            ctx.lineWidth = 2;
            ctx.strokeRect(sweetSpot.x, sweetSpot.y, sweetSpot.width, sweetSpot.height);
            ctx.setLineDash([]);
        }

        animationFrameIdRef.current = requestAnimationFrame(detectFace);
    };

    if (aiAssistantEnabled && detector) {
        detectFace();
    } else {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        setFeedback({ message: '', color: FEEDBACK_COLORS.neutral, showGuide: false });
    }
    
    // Set initial loading message
    if(aiAssistantEnabled && !detector) {
        setFeedback({ message: 'Loading AI Model...', color: FEEDBACK_COLORS.neutral, showGuide: false });
    }

    return () => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
    };
  }, [aiAssistantEnabled, detector]);

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
      <canvas ref={canvasRef} className={`absolute top-0 left-0 w-full h-full pointer-events-none transition-transform duration-300 ${isMirrored ? 'scale-x-[-1]' : ''}`} />
      {aiAssistantEnabled && feedback.message && (
        <div className="absolute bottom-4 flex flex-col items-center gap-2 pointer-events-none">
          <div 
            className="px-3 py-1.5 rounded-full text-sm font-semibold animate-fade-in text-white transition-colors"
            style={{ backgroundColor: `${feedback.color}BF` }} // Add 75% opacity
          >
              {feedback.message}
          </div>
          {backendInUse === 'cpu' && (
            <div className="bg-yellow-900/60 text-yellow-300 px-2 py-0.5 rounded-full text-xs font-semibold animate-fade-in">
              AI running in compatibility mode
            </div>
          )}
        </div>
      )}
       <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-20">
          <p className="text-lg font-semibold">Self-Monitoring View</p>
        </div>
    </div>
  );
};