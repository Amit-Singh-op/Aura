import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision';

interface ActiveOverlay {
  id: string;
  emoji?: string;
  position?: string;
}

export function useFaceTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  activeOverlay: ActiveOverlay,
  isMirrored: boolean
) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceTimeRef = useRef(-1);
  const overlayRef = useRef(activeOverlay);
  const mirroredRef = useRef(isMirrored);

  // Smoothing state
  const targetLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const smoothedLandmarksRef = useRef<NormalizedLandmark[] | null>(null);

  // Sync refs so requestAnimationFrame always reads the latest state without tearing down
  useEffect(() => { overlayRef.current = activeOverlay; }, [activeOverlay]);
  useEffect(() => { mirroredRef.current = isMirrored; }, [isMirrored]);

  // Load MediaPipe Model
  useEffect(() => {
    let active = true;
    async function loadModel() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        if (!active) return;
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU" // Use WebGL/GPU for maximum performance
          },
          runningMode: "VIDEO",
          numFaces: 1
        });
        if (!active) {
          landmarker.close();
          return;
        }
        faceLandmarkerRef.current = landmarker;
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Failed to load FaceLandmarker:", err);
      }
    }
    loadModel();
    return () => {
      active = false;
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
    };
  }, []);

  // Imperative Render Loop (Zero React Rerenders for 60FPS)
  useEffect(() => {
    if (!isModelLoaded) return;
    
    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = faceLandmarkerRef.current;
      
      if (video && canvas && landmarker && video.readyState >= 2) {
        // Match canvas coordinate space to video source dimensions
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
           canvas.width = video.videoWidth;
           canvas.height = video.videoHeight;
        }

        // 1. Run ML Inference (Throttled to max 24 FPS to save CPU and prevent UI lag)
        const now = performance.now();
        if (now - lastInferenceTimeRef.current > 42 && video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          lastInferenceTimeRef.current = now;
          const result = landmarker.detectForVideo(video, now);
          
          if (result.faceLandmarks.length > 0) {
            targetLandmarksRef.current = result.faceLandmarks[0];
            // Initialize smoothed landmarks on first detection to prevent flying in from (0,0)
            if (!smoothedLandmarksRef.current) {
              smoothedLandmarksRef.current = JSON.parse(JSON.stringify(result.faceLandmarks[0]));
            }
          } else {
            targetLandmarksRef.current = null;
            smoothedLandmarksRef.current = null;
          }
        }
          
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const overlay = overlayRef.current;
          // 2. Draw smoothed landmarks at 60 FPS
          if (overlay && overlay.id !== 'none' && targetLandmarksRef.current && smoothedLandmarksRef.current) {
            const target = targetLandmarksRef.current;
            const current = smoothedLandmarksRef.current;
            
            // Linear Interpolation (Lerp) for buttery smooth movement
            const lerpFactor = 0.4;
            for (let i = 0; i < target.length; i++) {
              current[i].x += (target[i].x - current[i].x) * lerpFactor;
              current[i].y += (target[i].y - current[i].y) * lerpFactor;
              current[i].z += (target[i].z - current[i].z) * lerpFactor;
            }

            const landmarks = current;
            
            ctx.save();
            // Apply mirror transform if camera is flipped
            if (mirroredRef.current) {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
            }

            // Use temples to measure raw face width in pixels
            const leftTemple = landmarks[234];
            const rightTemple = landmarks[454];
            const faceWidth = Math.abs(rightTemple.x - leftTemple.x) * canvas.width;
            
            const drawEmoji = (emoji: string, targetIdx: number, scale: number, yOffsetScale: number, fixedAngle?: number) => {
              const pos = landmarks[targetIdx];
              const x = pos.x * canvas.width;
              const y = pos.y * canvas.height + (faceWidth * yOffsetScale);
              
              // Calculate dynamic head tilt based on eyes
              const dx = (landmarks[33].x - landmarks[263].x);
              const dy = (landmarks[33].y - landmarks[263].y);
              let angle = Math.atan2(dy, dx);
              // Adjust angle offset since dx goes from left to right eye
              angle = angle > 0 ? angle - Math.PI : angle + Math.PI;

              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(fixedAngle !== undefined ? fixedAngle : angle);
              ctx.font = `${faceWidth * scale}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(emoji, 0, 0);
              ctx.restore();
            };

            // Map overlays to specific facial landmarks
            if (overlay.id === 'crown') {
              drawEmoji('👑', 10, 1.2, -0.6); // Forehead top
            } else if (overlay.id === 'party') {
              drawEmoji('🥳', 1, 1.4, -0.1); // Full face
            } else if (overlay.id === 'alien') {
              drawEmoji('👽', 1, 1.5, -0.1); // Full face
            } else if (overlay.id === 'clown') {
              // Clown nose!
              const nose = landmarks[1];
              ctx.beginPath();
              ctx.arc(nose.x * canvas.width, nose.y * canvas.height, faceWidth * 0.15, 0, Math.PI * 2);
              ctx.fillStyle = '#FF0000';
              ctx.fill();
              ctx.lineWidth = 4;
              ctx.strokeStyle = '#8B0000';
              ctx.stroke();
            } else if (overlay.id === 'rainbow') {
              drawEmoji('🌈', 14, 0.8, 0.2); // Lower lip (puking rainbow)
            } else if (overlay.id === 'hearts') {
              drawEmoji('💖', 33, 0.4, -0.2); // Left eye
              drawEmoji('💖', 263, 0.4, -0.2); // Right eye
            } else if (overlay.id === 'stars') {
              drawEmoji('⭐', 33, 0.4, -0.2); // Left eye
              drawEmoji('⭐', 263, 0.4, -0.2); // Right eye
            } else if (overlay.id === 'fire') {
              drawEmoji('🔥', 10, 0.8, -0.5); 
              drawEmoji('🔥', 234, 0.6, -0.1); // Left temple
              drawEmoji('🔥', 454, 0.6, -0.1); // Right temple
            } else if (overlay.id === 'ghost') {
              drawEmoji('👻', 1, 1.3, -0.1);
            } else if (overlay.id === 'sparkles') {
              drawEmoji('✨', 10, 0.5, -0.4);
              drawEmoji('✨', 234, 0.4, 0);
              drawEmoji('✨', 454, 0.4, 0);
            }

            ctx.restore();
          }
        }
      }
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isModelLoaded, videoRef, canvasRef]);

  return { isModelLoaded };
}
