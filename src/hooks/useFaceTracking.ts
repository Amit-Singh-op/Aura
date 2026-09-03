import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface ActiveOverlay {
  id: string;
  emoji?: string;
  image?: HTMLImageElement; // Support for realistic PNG/SVG masks
  position?: string;
}

// Global Singleton for the ML Model so it can be preloaded in the background
let sharedFaceLandmarker: FaceLandmarker | null = null;
let modelLoadPromise: Promise<FaceLandmarker> | null = null;

// Persistent state for interactive filters
let bananaBiteState = 0;
let lastMouthOpenState = false;

// Global Cache for Image Masks
export const preloadedMaskImages: Record<string, HTMLImageElement> = {};

const MASK_URLS = [
  '/masks/aviators.svg',
  '/masks/joker.svg',
  '/masks/dog.svg',
  '/masks/banana.svg',
  '/masks/real_banana.png'
];

export function preloadMaskImages() {
  if (typeof window === 'undefined') return;
  MASK_URLS.forEach(url => {
    if (!preloadedMaskImages[url]) {
      const img = new window.Image();
      img.src = url;
      img.onload = () => { preloadedMaskImages[url] = img; };
    }
  });
}

export function preloadFaceModel() {
  if (typeof window === 'undefined') return;
  
  preloadMaskImages(); // Start fetching masks in the background immediately
  
  if (sharedFaceLandmarker || modelLoadPromise) return;

  modelLoadPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU" // Use WebGL/GPU for maximum performance
        },
        runningMode: "VIDEO",
        numFaces: 1
      });
      sharedFaceLandmarker = landmarker;

      // Warm up the WebGL shaders in the background!
      // This prevents the UI from freezing when the camera filter is first opened.
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 1;
      dummyCanvas.height = 1;
      try {
        landmarker.detectForVideo(dummyCanvas, performance.now());
      } catch (e) {
        // Ignore dummy frame errors
      }

      return landmarker;
    } catch (err) {
      console.error("Failed to load FaceLandmarker:", err);
      throw err;
    }
  })();
}

export function useFaceTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  activeOverlay: ActiveOverlay,
  isMirrored: boolean,
  cssFilter: string = 'none',
  tint: string | null = null
) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceTimeRef = useRef(-1);
  const overlayRef = useRef(activeOverlay);
  const mirroredRef = useRef(isMirrored);
  const cssFilterRef = useRef(cssFilter);
  const tintRef = useRef(tint);

  // Smoothing state
  const targetLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const smoothedLandmarksRef = useRef<NormalizedLandmark[] | null>(null);

  // Sync refs so requestAnimationFrame always reads the latest state without tearing down
  useEffect(() => { overlayRef.current = activeOverlay; }, [activeOverlay]);
  useEffect(() => { mirroredRef.current = isMirrored; }, [isMirrored]);
  useEffect(() => { cssFilterRef.current = cssFilter; }, [cssFilter]);
  useEffect(() => { tintRef.current = tint; }, [tint]);

  // Load MediaPipe Model
  useEffect(() => {
    let active = true;
    
    // Kick off load if not already started
    preloadFaceModel();
    
    if (sharedFaceLandmarker) {
      faceLandmarkerRef.current = sharedFaceLandmarker;
      setIsModelLoaded(true);
    } else if (modelLoadPromise) {
      modelLoadPromise.then((landmarker) => {
        if (!active) return;
        faceLandmarkerRef.current = landmarker;
        setIsModelLoaded(true);
      });
    }

    return () => {
      active = false;
      // Note: We do NOT close the landmarker here anymore because it's a global singleton!
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
          // 1. Draw Raw Video Frame to Canvas
          ctx.save();
          if (mirroredRef.current) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          if (cssFilterRef.current && cssFilterRef.current !== 'none') {
            ctx.filter = cssFilterRef.current;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Apply Tint Overlay if present
          if (tintRef.current) {
            ctx.fillStyle = tintRef.current;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          const overlay = overlayRef.current;
          // 2. Draw smoothed AR landmarks at 60 FPS on top of the video
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

            const drawImageMask = (img: HTMLImageElement, centerIdx: number, scale: number, yOffsetScale: number, fixedAngle?: number) => {
              const pos = landmarks[centerIdx];
              const x = pos.x * canvas.width;
              const y = pos.y * canvas.height + (faceWidth * yOffsetScale);
              
              // Dynamic head tilt
              const dx = (landmarks[33].x - landmarks[263].x);
              const dy = (landmarks[33].y - landmarks[263].y);
              let angle = Math.atan2(dy, dx);
              angle = angle > 0 ? angle - Math.PI : angle + Math.PI;

              const w = faceWidth * scale;
              const h = w * (img.height / img.width); // maintain aspect ratio

              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(fixedAngle !== undefined ? fixedAngle : angle);
              ctx.drawImage(img, -w/2, -h/2, w, h);
              ctx.restore();
            };

            // Map overlays to specific facial landmarks
            if (overlay.image) {
              // Custom Realistic Image Masks
              if (overlay.id === 'aviators') {
                drawImageMask(overlay.image, 168, 2.0, 0); // Bridge of nose
              } else if (overlay.id === 'dog') {
                drawImageMask(overlay.image, 1, 1.8, -0.2); // Full face centered on tip of nose
              } else if (overlay.id === 'joker') {
                drawImageMask(overlay.image, 1, 1.8, 0); 
              } else if (overlay.id === 'banana') {
                if (overlay.image) {
                  const upperLip = landmarks[13];
                  const lowerLip = landmarks[14];
                  const mouthOpen = Math.abs(lowerLip.y - upperLip.y) * canvas.height;
                  const isMouthOpen = mouthOpen > faceWidth * 0.05;

                  if (isMouthOpen && !lastMouthOpenState) {
                    lastMouthOpenState = true;
                  } else if (!isMouthOpen && lastMouthOpenState) {
                    // Took a bite when closing mouth!
                    bananaBiteState += 0.15;
                    if (bananaBiteState >= 0.7) {
                      bananaBiteState = 0; // finished eating, respawn new banana
                    }
                    lastMouthOpenState = false;
                  }
                  
                  // Position banana so the cut edge is EXACTLY at the upper lip
                  const pos = landmarks[13];
                  const x = pos.x * canvas.width;
                  const y = pos.y * canvas.height;
                  
                  const dx = (landmarks[33].x - landmarks[263].x);
                  const dy = (landmarks[33].y - landmarks[263].y);
                  let angle = Math.atan2(dy, dx);
                  angle = angle > 0 ? angle - Math.PI : angle + Math.PI;

                  ctx.save();
                  ctx.translate(x, y);
                  // Slightly dampen the tilt so it's comfortable to "hold" to your mouth
                  ctx.rotate(angle * 0.5);
                  
                  const scale = faceWidth * 1.5;
                  const w = scale;
                  const h = w * (overlay.image.height / overlay.image.width);
                  
                  // The banana image points straight up.
                  const sY = bananaBiteState * overlay.image.height;
                  const sHeight = overlay.image.height - sY;
                  const dHeight = h * (1 - bananaBiteState);
                  
                  // 1. Create a Wavy Bite Mark Clip Path
                  // This clips off the straight edge and gives it teeth marks!
                  ctx.beginPath();
                  ctx.moveTo(-w, dHeight);
                  ctx.lineTo(w, dHeight);
                  ctx.lineTo(w, 0);
                  if (bananaBiteState > 0) {
                    // Wavy teeth marks across the fruit area
                    ctx.lineTo(w/4, 0);
                    ctx.quadraticCurveTo(w * 0.125, w * 0.15, 0, 0); // Right bite
                    ctx.quadraticCurveTo(-w * 0.125, w * 0.15, -w/4, 0); // Left bite
                  }
                  ctx.lineTo(-w, 0);
                  ctx.clip(); // Apply the clip mask! Anything with y < 0 is hidden (behind upper lip)
                  
                  // 2. Kinetic Eating Animation
                  // When mouth is open, we physically shove the image UP (negative Y)
                  // Since we are clipped at y=0, the shoved part vanishes inside the mouth!
                  const shoveAmount = isMouthOpen ? mouthOpen * 0.6 : 0;
                  
                  ctx.drawImage(
                    overlay.image,
                    0, sY, overlay.image.width, sHeight,
                    -w/2, -shoveAmount, w, dHeight
                  );
                  
                  ctx.restore();
                }
              } else {
                drawImageMask(overlay.image, 1, 1.5, 0); // Default full face mapping
              }
            } else if (overlay.id === 'crown') {
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
