'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Camera, RotateCcw, Send, ChevronLeft, ChevronRight,
  Sparkles, RefreshCcw, AlertCircle, Zap, Loader2, Check, Video
} from 'lucide-react';
import { useFaceTracking, ActiveOverlay, preloadedMaskImages } from '@/hooks/useFaceTracking';

// ─── Filter definitions ────────────────────────────────────────────────────────
interface Filter {
  id: string; label: string; emoji: string;
  cssFilter: string; canvasEffect?: 'glitch' | 'vhs' | 'pixelate';
  tint?: string; bg: string; accent: string; // accent = dot/ring color
}

const FILTERS: Filter[] = [
  { id: 'normal',  label: 'Normal',  emoji: '😊', cssFilter: 'none',                                                                       bg: '#FFF6E9', accent: '#2B1B3D' },
  { id: 'vivid',   label: 'Vivid',   emoji: '🌈', cssFilter: 'saturate(2) contrast(1.2) brightness(1.1)',                                  bg: '#FFCC33', accent: '#FF6B35' },
  { id: 'comic',   label: 'Comic',   emoji: '💥', cssFilter: 'contrast(1.8) saturate(1.5)',    tint: 'rgba(108,74,182,0.14)',              bg: '#6C4AB6', accent: '#FFCC33' },
  { id: 'neon',    label: 'Neon',    emoji: '⚡', cssFilter: 'brightness(1.4) saturate(3) hue-rotate(30deg)', tint:'rgba(31,181,163,0.18)', bg: '#1FB5A3', accent: '#FFCC33' },
  { id: 'vintage', label: 'Vintage', emoji: '📷', cssFilter: 'sepia(0.65) contrast(1.1) brightness(0.95) saturate(0.8)',                   bg: '#d97706', accent: '#FFF6E9' },
  { id: 'bw',      label: 'B&W',     emoji: '🎞️', cssFilter: 'grayscale(1) contrast(1.3)',                                                 bg: '#374151', accent: '#FFF6E9' },
  { id: 'glitch',  label: 'Glitch',  emoji: '👾', cssFilter: 'hue-rotate(90deg) saturate(2)',  canvasEffect: 'glitch',                    bg: '#FF3D7F', accent: '#FFCC33' },
  { id: 'vhs',     label: 'VHS',     emoji: '📼', cssFilter: 'saturate(1.4) contrast(0.9) brightness(0.85)', canvasEffect: 'vhs', tint:'rgba(0,255,100,0.06)', bg: '#15803d', accent: '#FFCC33' },
  { id: 'pixel',   label: 'Pixel',   emoji: '🕹️', cssFilter: 'none',                           canvasEffect: 'pixelate',                  bg: '#FF6B35', accent: '#2B1B3D' },
  { id: 'warm',    label: 'Warm',    emoji: '🔆', cssFilter: 'sepia(0.3) saturate(1.6) brightness(1.1)', tint:'rgba(255,107,53,0.08)',    bg: '#fb923c', accent: '#2B1B3D' },
  { id: 'cool',    label: 'Cool',    emoji: '❄️', cssFilter: 'hue-rotate(195deg) saturate(1.3) brightness(1.05)',                          bg: '#3b82f6', accent: '#FFF6E9' },
  { id: 'dreamy',  label: 'Dreamy',  emoji: '🌙', cssFilter: 'brightness(1.15) saturate(1.3) contrast(0.95)', tint:'rgba(180,140,255,0.18)', bg: '#9333ea', accent: '#FFCC33' },
  { id: 'fire',    label: 'Fire',    emoji: '🔥', cssFilter: 'sepia(0.4) saturate(3) hue-rotate(-20deg) brightness(1.2)', tint:'rgba(255,61,127,0.12)', bg: '#FF2A4C', accent: '#FFCC33' },
  { id: 'matrix',  label: 'Matrix',  emoji: '💻', cssFilter: 'grayscale(1) brightness(0.7) contrast(1.5)', tint:'rgba(0,255,80,0.28)',   bg: '#14532d', accent: '#22c55e' },
  { id: 'holo',    label: 'Holo',    emoji: '✨', cssFilter: 'brightness(1.2) saturate(2) contrast(1.1)', tint:'rgba(99,102,241,0.14)',   bg: '#7c3aed', accent: '#FFCC33' },
];

const AR_OVERLAYS = [
  { id: 'none',     label: 'None',     emoji: '',        position: 'top'    },
  { id: 'aviators', label: 'Aviators', emoji: '🕶️',     imageUrl: '/masks/aviators.svg' },
  { id: 'joker',    label: 'Joker',    emoji: '🤡',      imageUrl: '/masks/joker.svg' },
  { id: 'dog',      label: 'Dog',      emoji: '🐶',      imageUrl: '/masks/dog.svg' },
  { id: 'banana',   label: 'Banana',   emoji: '🍌',      imageUrl: '/masks/real_banana.png' },
  { id: 'sparkles', label: 'Sparkles', emoji: '✨✨✨',   position: 'top'    },
  { id: 'crown',    label: 'Crown',    emoji: '👑',       position: 'top'    },
  { id: 'party',    label: 'Party',    emoji: '🎉🎊🥳',   position: 'top'    },
  { id: 'fire',     label: 'Fire',     emoji: '🔥',       position: 'bottom' },
  { id: 'hearts',   label: 'Hearts',   emoji: '💕💖💗',   position: 'top'    },
  { id: 'alien',    label: 'Alien',    emoji: '👽',       position: 'top'    },
  { id: 'rainbow',  label: 'Rainbow',  emoji: '🌈',       position: 'top'    },
  { id: 'ghost',    label: 'Ghost',    emoji: '👻',       position: 'center' },
  { id: 'clown',    label: 'Clown',    emoji: '🤡',       position: 'top'    },
  { id: 'stars',    label: 'Stars',    emoji: '🌟🌟',     position: 'top'    },
];

function getCameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError': case 'PermissionDeniedError':
        return 'Permission denied. Tap the 🔒 lock in your address bar, allow Camera, then tap Retry.';
      case 'NotFoundError': case 'DevicesNotFoundError':
        return 'No camera found on this device.';
      case 'NotReadableError': case 'TrackStartError':
        return 'Camera is busy in another app. Close it and tap Retry.';
      case 'SecurityError':
        return 'Camera requires HTTPS. Open via https:// or localhost.';
      default:
        return `Camera error: ${err.message}`;
    }
  }
  return 'Could not access camera. Check permissions and try again.';
}

interface CameraFilterProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export function CameraFilter({ onCapture, onClose }: CameraFilterProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const isMirrored = useRef(true);
  const isMounted  = useRef(true);
  const cameraReqId = useRef(0);

  const [activeFilterIdx,  setActiveFilterIdx]  = useState(0);
  const [activeOverlayIdx, setActiveOverlayIdx] = useState(0);
  const [facingMode,       setFacingMode]       = useState<'user' | 'environment'>('user');
  const [cameraStatus,     setCameraStatus]     = useState<'loading' | 'ready' | 'error'>('loading');
  const [cameraError,      setCameraError]      = useState('');
  const [capturedPhoto,    setCapturedPhoto]    = useState<string | null>(null);
  const [capturedVideo,    setCapturedVideo]    = useState<string | null>(null);
  const [isCapturing,      setIsCapturing]      = useState(false);
  const [isRecording,      setIsRecording]      = useState(false);
  const [recordingTime,    setRecordingTime]    = useState(0);
  const [showFilters,      setShowFilters]      = useState(true);
  const [canFlip,          setCanFlip]          = useState(false);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingActionRef = useRef<boolean>(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    AR_OVERLAYS.forEach(ov => {
      if (ov.imageUrl && !loadedImages[ov.id]) {
        if (preloadedMaskImages[ov.imageUrl]) {
          setLoadedImages(prev => ({...prev, [ov.id]: preloadedMaskImages[ov.imageUrl!]}));
        } else {
          const img = new window.Image();
          img.src = ov.imageUrl;
          img.onload = () => setLoadedImages(prev => ({...prev, [ov.id]: img}));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollFilters = (dir: 1 | -1) => {
    if (filterScrollRef.current) {
      filterScrollRef.current.scrollBy({ left: dir * 250, behavior: 'smooth' });
    }
  };

  const activeFilter  = FILTERS[activeFilterIdx];
  const baseOverlay = AR_OVERLAYS[activeOverlayIdx];
  const activeOverlay = { ...baseOverlay, image: baseOverlay.imageUrl ? loadedImages[baseOverlay.id] : undefined };

  const { isModelLoaded } = useFaceTracking(videoRef, canvasRef, activeOverlay as ActiveOverlay, isMirrored.current, activeFilter.cssFilter, activeFilter.tint);

  // ── Stop stream & close ────────────────────────────────────────────────────
  // Use a plain object ref so React StrictMode double-invoke can't null it
  // before the real unmount happens.
  const stopStream = useCallback(() => {
    cameraReqId.current += 1; // Abort any pending startCamera loops
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch { /**/ } });
      streamRef.current = null;
    }
    // Also stop any tracks still attached to the <video> element directly
    const vid = videoRef.current;
    if (vid) {
      const attached = vid.srcObject as MediaStream | null;
      if (attached) attached.getTracks().forEach(t => { try { t.stop(); } catch { /**/ } });
      vid.srcObject = null;
    }
  }, []);

  const handleClose = useCallback(() => { stopStream(); onClose(); }, [stopStream, onClose]);

  // Cleanup on unmount — runs even if handleClose was never called
  useEffect(() => {
    isMounted.current = true;
    const vid = videoRef.current;
    return () => {
      isMounted.current = false;
      cameraReqId.current += 1;
      // Read directly from DOM to survive StrictMode's double-invoke
      if (vid) {
        const s = vid.srcObject as MediaStream | null;
        if (s) s.getTracks().forEach(t => { try { t.stop(); } catch { /**/ } });
        vid.srcObject = null;
      }
      const s2 = streamRef.current;
      if (s2) s2.getTracks().forEach(t => { try { t.stop(); } catch { /**/ } });
      streamRef.current = null;
    };
  }, []); // empty deps — only on unmount

  // ── Flip detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices()
      .then(d => setCanFlip(d.filter(x => x.kind === 'videoinput').length > 1))
      .catch(() => setCanFlip(false));
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async (mode: 'user' | 'environment', isRetry = false) => {
    stopStream();
    const currentReqId = ++cameraReqId.current;

    setCameraStatus('loading');
    setCameraError('');
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError('Your browser does not support camera. Try Chrome or Safari.');
      return;
    }
    const tries: MediaStreamConstraints[] = [
      { video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: mode }, audio: false },
      { video: true, audio: false },
    ];
    for (let i = isRetry ? 2 : 0; i < tries.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(tries[i]);
        
        // If unmounted or a new request started while waiting for getUserMedia, stop immediately!
        if (!isMounted.current || cameraReqId.current !== currentReqId) {
          stream.getTracks().forEach(t => { try { t.stop(); } catch { /**/ } });
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>(res => {
            const v = videoRef.current!;
            if (v.readyState >= 2) { res(); return; }
            v.onloadedmetadata = () => res();
            setTimeout(res, 3000);
          });
        }
        
        if (!isMounted.current || cameraReqId.current !== currentReqId) return;

        setCameraStatus('ready');
        return;
      } catch (err) {
        const n = err instanceof DOMException ? err.name : '';
        if (['NotAllowedError','PermissionDeniedError','NotFoundError','DevicesNotFoundError','SecurityError'].includes(n) || i === tries.length - 1) {
          if (!isMounted.current || cameraReqId.current !== currentReqId) return;
          setCameraStatus('error');
          setCameraError(getCameraErrorMessage(err));
          return;
        }
      }
    }
  }, [stopStream]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { startCamera(facingMode); }, []);

  const handleFlip = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next); isMirrored.current = next === 'user';
    startCamera(next);
  };

  const handleCapture = () => {
    if (!canvasRef.current || isCapturing || cameraStatus !== 'ready') return;
    setIsCapturing(true);
    // The unified canvas already has the video drawn to it along with the AR overlays!
    setCapturedPhoto(canvasRef.current.toDataURL('image/jpeg', 0.92));
    setIsCapturing(false);
  };

  // ── Video capture (GIFs) ──────────────────────────────────────────────────
  const startRecording = () => {
    if (!canvasRef.current || cameraStatus !== 'ready') return;
    recordedChunksRef.current = [];
    const stream = canvasRef.current.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      setCapturedVideo(URL.createObjectURL(blob));
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  };

  const handleSend = () => {
    if (capturedVideo) {
      const reader = new FileReader();
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      reader.onloadend = () => {
         onCapture(reader.result as string);
         stopStream(); onClose();
      };
      reader.readAsDataURL(blob);
      return;
    }
    if (!capturedPhoto) return;
    onCapture(capturedPhoto); stopStream(); onClose();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-comic-ink/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* ── Card ──
           Mobile: true fullscreen (w-full h-[100dvh])
           Tablet/Desktop: wide + very tall — camera viewport fills the extra space
      */}
      <div className="
        relative flex flex-col
        w-full h-[100dvh]
        sm:w-[96vw] sm:max-w-4xl sm:h-[95vh] sm:max-h-[940px]
        bg-comic-bg
        sm:rounded-3xl sm:border-4 sm:border-comic-ink sm:shadow-[8px_8px_0_0_#2B1B3D]
        overflow-hidden
      ">

        {/* ══ HEADER ══════════════════════════════════════════════════════ */}
        <div className="relative flex items-center justify-between px-5 py-3 bg-comic-pink border-b-4 border-comic-ink shrink-0 overflow-hidden">
          {/* decorative blobs */}
          <div className="absolute -top-7 -right-7 w-24 h-24 bg-comic-yellow rounded-full border-4 border-comic-ink opacity-60 pointer-events-none" />
          <div className="absolute -bottom-5 left-[35%] w-12 h-12 bg-comic-teal rounded-full border-4 border-comic-ink opacity-50 pointer-events-none" />

          <h2 className="z-10 flex items-center gap-2 font-heading font-black text-xl sm:text-2xl text-comic-ink uppercase tracking-wide">
            <Camera className="w-6 h-6 sm:w-7 sm:h-7" />
            Snap Filter!
          </h2>

          <div className="z-10 flex items-center gap-2">
            {/* active filter badge */}
            {cameraStatus === 'ready' && !capturedPhoto && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-comic-yellow border-2 border-comic-ink rounded-full font-heading font-black text-sm text-comic-ink shadow-comic-sm whitespace-nowrap">
                {activeFilter.emoji} {activeFilter.label}
              </span>
            )}
            {canFlip && cameraStatus === 'ready' && !capturedPhoto && (
              <button onClick={handleFlip} title="Flip camera"
                className="p-2 rounded-xl bg-comic-teal border-2 border-comic-ink shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all active:translate-y-0.5 active:shadow-none">
                <RefreshCcw className="w-5 h-5 text-comic-ink" />
              </button>
            )}
            <button onClick={handleClose} title="Close"
              className="p-2 rounded-xl bg-comic-red border-2 border-comic-ink shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all active:translate-y-0.5 active:shadow-none">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* ══ CAMERA VIEWPORT ═════════════════════════════════════════════ */}
        {/* flex-1 + min-h-0 fills all remaining space after header + bottom panel.
            bg-black gives the camera that cinematic look.
            On a 940px tall card with ~60px header + ~210px controls = ~670px of camera! */}
        <div className="relative flex-1 min-h-0 bg-black border-b-4 border-comic-ink overflow-hidden">

          {/* Loading */}
          {cameraStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-comic-bg gap-4">
              <div className="w-24 h-24 rounded-full bg-comic-yellow border-4 border-comic-ink shadow-comic flex items-center justify-center animate-bounce">
                <Camera className="w-12 h-12 text-comic-ink" />
              </div>
              <p className="font-heading font-black text-comic-ink text-2xl animate-pulse">Starting camera…</p>
              <p className="font-heading text-comic-ink/50 text-sm font-bold">Allow camera when prompted 👆</p>
            </div>
          )}

          {/* Error */}
          {cameraStatus === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-comic-bg p-8 text-center gap-5">
              <div className="absolute top-5 left-5 w-16 h-16 bg-comic-yellow/40 rounded-full border-2 border-comic-ink/20 pointer-events-none" />
              <div className="absolute bottom-10 right-8 w-10 h-10 bg-comic-teal/30 rounded-full border-2 border-comic-ink/20 pointer-events-none" />
              <div className="w-24 h-24 rounded-full bg-comic-red/10 border-4 border-comic-red flex items-center justify-center shadow-comic-sm z-10">
                <AlertCircle className="w-12 h-12 text-comic-red" />
              </div>
              <div className="z-10 max-w-sm">
                <p className="font-heading font-black text-comic-ink text-2xl mb-3">Oops! 😅</p>
                <p className="text-comic-ink/70 text-sm font-bold leading-relaxed">{cameraError}</p>
              </div>
              <button onClick={() => startCamera(facingMode, true)}
                className="z-10 flex items-center gap-2 px-7 py-3 bg-comic-yellow border-4 border-comic-ink rounded-2xl font-heading font-black text-comic-ink text-base shadow-comic hover:-translate-y-1 hover:shadow-comic-hover transition-all active:translate-y-0.5 active:shadow-none">
                <RefreshCcw className="w-5 h-5" /> Retry
              </button>
              <p className="z-10 text-xs text-comic-ink/40 font-bold font-heading">
                Tip: tap 🔒 in browser bar → allow Camera
              </p>
            </div>
          )}

          {/* Captured photo or video preview */}
          {(capturedPhoto || capturedVideo) && (
            <div className="absolute inset-0 bg-black z-10 flex items-center justify-center">
              {capturedVideo ? (
                <video src={capturedVideo} autoPlay loop playsInline className="w-full h-full object-contain" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={capturedPhoto!} alt="Captured snap" className="w-full h-full object-contain" />
              )}
              {/* halftone comic texture overlay */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage:'radial-gradient(rgba(43,27,61,0.035) 1px,transparent 1px)', backgroundSize:'8px 8px' }} />
            </div>
          )}

          {/* Live feed */}
          <div className={`absolute inset-0 ${capturedPhoto || capturedVideo ? 'invisible' : ''}`}>
            {/* The video element is now hidden visually since the Canvas handles drawing it! */}
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain opacity-0 pointer-events-none" />
            
            {/* Unified AR Tracking Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10" />

            {activeFilter.tint && cameraStatus === 'ready' && (
              <div className="absolute inset-0 pointer-events-none transition-colors duration-300"
                  style={{ backgroundColor: activeFilter.tint }} />
              )}
              {activeFilter.canvasEffect === 'vhs' && cameraStatus === 'ready' && (
                <div className="absolute inset-0 pointer-events-none opacity-40"
                  style={{ backgroundImage:'repeating-linear-gradient(0deg,rgba(0,0,0,0.12) 0px,rgba(0,0,0,0.12) 1px,transparent 1px,transparent 4px)' }} />
              )}
              {activeFilter.canvasEffect === 'glitch' && cameraStatus === 'ready' && (
                <>
                  <video autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain opacity-30 pointer-events-none"
                    style={{ filter:'hue-rotate(180deg) saturate(3)', transform:isMirrored.current?'scaleX(-1) translateX(8px)':'translateX(8px)', mixBlendMode:'screen' }}
                    ref={el => { if (el && streamRef.current) el.srcObject = streamRef.current; }} />
                  <video autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain opacity-20 pointer-events-none"
                    style={{ filter:'hue-rotate(-90deg) saturate(2)', transform:isMirrored.current?'scaleX(-1) translateX(-6px)':'translateX(-6px)', mixBlendMode:'screen' }}
                    ref={el => { if (el && streamRef.current) el.srcObject = streamRef.current; }} />
                </>
              )}
              {/* Comic viewfinder corners */}
              {cameraStatus === 'ready' && (
                <>
                  <div className="absolute top-3 left-3 w-8 h-8 border-t-4 border-l-4 border-comic-yellow pointer-events-none rounded-tl-sm" />
                  <div className="absolute top-3 right-3 w-8 h-8 border-t-4 border-r-4 border-comic-yellow pointer-events-none rounded-tr-sm" />
                  <div className="absolute bottom-3 left-3 w-8 h-8 border-b-4 border-l-4 border-comic-yellow pointer-events-none rounded-bl-sm" />
                  <div className="absolute bottom-3 right-3 w-8 h-8 border-b-4 border-r-4 border-comic-yellow pointer-events-none rounded-br-sm" />
                </>
              )}
            </div>
        </div>

        {/* ══ BOTTOM PANEL ════════════════════════════════════════════════ */}
        <div className="shrink-0 bg-comic-bg">

          {(capturedPhoto || capturedVideo) ? (
            /* ── Retake / Send ── */
            <div className="flex items-stretch gap-4 p-4 sm:p-5">
              <button onClick={() => { setCapturedPhoto(null); setCapturedVideo(null); }}
                className="flex-1 py-3.5 rounded-2xl bg-white border-4 border-comic-ink font-heading font-black text-comic-ink text-lg shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5" /> Retake
              </button>
              <button onClick={handleSend}
                className="flex-1 py-3.5 rounded-2xl bg-comic-orange border-4 border-comic-ink font-heading font-black text-comic-ink text-lg shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2">
                <Send className="w-5 h-5" /> Send! 🚀
              </button>
            </div>
          ) : (
            <div className="px-4 sm:px-5 pt-3 sm:pt-4 pb-4 sm:pb-5 flex flex-col gap-3 sm:gap-4">

              {/* ── Tab row ──────────────────────────────────────────────── */}
              <div className="flex gap-2">
                {/* Filters tab */}
                <button
                  onClick={() => setShowFilters(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border-4 font-heading font-black text-base transition-all ${
                    showFilters
                      ? 'bg-comic-yellow text-comic-ink border-comic-ink shadow-comic-sm -translate-y-0.5'
                      : 'bg-white text-comic-ink/60 border-comic-ink/30 hover:border-comic-ink/60 hover:text-comic-ink'
                  }`}
                >
                  🎨 Filters
                </button>
                {/* Overlays tab */}
                <button
                  onClick={() => setShowFilters(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border-4 font-heading font-black text-base transition-all ${
                    !showFilters
                      ? 'bg-comic-teal text-white border-comic-ink shadow-comic-sm -translate-y-0.5'
                      : 'bg-white text-comic-ink/60 border-comic-ink/30 hover:border-comic-ink/60 hover:text-comic-ink'
                  }`}
                >
                  ✨ Overlays
                </button>
              </div>

              {/* ── Filter / Overlay strip inside a themed box ────────── */}
              <div className={`rounded-2xl border-4 border-comic-ink px-3 py-3 sm:px-4 sm:py-3.5 ${
                showFilters ? 'bg-comic-yellow/20' : 'bg-comic-teal/10'
              } shadow-comic-sm`}>

                {showFilters ? (
                  /* Filters */
                  <div className="flex items-center gap-2">
                    {/* ← arrow */}
                    <button
                      onClick={() => scrollFilters(-1)}
                      className="hidden sm:flex shrink-0 w-9 h-9 rounded-xl bg-comic-yellow border-2 border-comic-ink items-center justify-center text-comic-ink hover:shadow-comic-sm transition-all active:scale-90 shadow-comic-sm"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    {/* Filter pills */}
                    <div ref={filterScrollRef} className="flex gap-2 sm:gap-3 flex-1 overflow-x-auto py-3 px-1 scrollbar-hide">
                      {FILTERS.map((f, i) => {
                        const isActive = i === activeFilterIdx;
                        return (
                          <button
                            key={f.id}
                            onClick={() => setActiveFilterIdx(i)}
                            className={`shrink-0 flex flex-col items-center gap-2 transition-all duration-200 ${
                              isActive ? 'scale-110' : 'opacity-65 hover:opacity-90 hover:scale-105'
                            }`}
                          >
                            {/* Circle */}
                            <div
                              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 flex items-center justify-center text-xl sm:text-2xl relative transition-all ${
                                isActive ? 'border-comic-ink shadow-comic-sm' : 'border-comic-ink/40'
                              }`}
                              style={{ background: f.bg }}
                            >
                              <span className="drop-shadow-sm leading-none">{f.emoji}</span>
                              {/* Active ring pulse */}
                              {isActive && (
                                <div className="absolute inset-0 rounded-full border-4 border-comic-ink animate-ping opacity-20" />
                              )}
                            </div>
                            {/* Label */}
                            <span
                              className={`font-heading font-black text-[10px] sm:text-[11px] leading-tight text-center w-12 sm:w-14 truncate transition-colors ${
                                isActive ? 'text-comic-ink' : 'text-comic-ink/60'
                              }`}
                            >
                              {f.label}
                            </span>
                            {/* Active dot */}
                            <div className={`w-1.5 h-1.5 rounded-full bg-comic-ink mt-0.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                          </button>
                        );
                      })}
                    </div>

                    {/* → arrow */}
                    <button
                      onClick={() => scrollFilters(1)}
                      className="hidden sm:flex shrink-0 w-9 h-9 rounded-xl bg-comic-yellow border-2 border-comic-ink items-center justify-center text-comic-ink hover:shadow-comic-sm transition-all active:scale-90 shadow-comic-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  /* Overlays */
                  <div className="flex gap-2 sm:gap-3 overflow-x-auto py-3 px-2 scrollbar-hide">
                    {AR_OVERLAYS.map((ov, idx) => {
                      const isActive = idx === activeOverlayIdx;
                      return (
                        <button
                          key={ov.id}
                          onClick={() => setActiveOverlayIdx(idx)}
                          className={`shrink-0 flex flex-col items-center gap-2 transition-all duration-200 ${
                            isActive ? 'scale-110' : 'opacity-65 hover:opacity-90 hover:scale-105'
                          }`}
                        >
                          <div
                            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 flex items-center justify-center text-xl sm:text-2xl bg-white relative transition-all ${
                              isActive ? 'border-comic-teal shadow-comic-sm' : 'border-comic-ink/40'
                            }`}
                          >
                            {ov.id === 'none'
                              ? <X className="w-5 h-5 sm:w-6 sm:h-6 text-comic-ink/50" />
                              : <span className="leading-none">{Array.from(ov.emoji)[0]}</span>
                            }
                            {isActive && (
                              <div className="absolute inset-0 rounded-full border-4 border-comic-teal animate-ping opacity-20" />
                            )}
                          </div>
                          <span className={`font-heading font-black text-[10px] sm:text-[11px] leading-tight text-center w-12 sm:w-14 truncate ${isActive ? 'text-comic-teal' : 'text-comic-ink/60'}`}>
                            {ov.label}
                          </span>
                          {/* Active dot */}
                          <div className={`w-1.5 h-1.5 rounded-full bg-comic-teal mt-0.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Shutter row ───────────────────────────────────────── */}
              <div className="relative flex items-center justify-center min-h-[96px]">
                {/* Left info pill */}
                <div className="absolute left-0 flex flex-col gap-1 items-start z-10 pointer-events-none">
                  <span className="px-3 py-1 bg-comic-purple/15 border-2 border-comic-purple/40 rounded-full font-heading font-black text-xs text-comic-purple whitespace-nowrap">
                    {activeFilter.emoji} {activeFilter.label}
                  </span>
                  {activeOverlay.id !== 'none' && (
                    <span className="px-3 py-1 bg-comic-teal/15 border-2 border-comic-teal/40 rounded-full font-heading font-black text-xs text-comic-teal whitespace-nowrap">
                      {Array.from(activeOverlay.emoji)[0]} {activeOverlay.label}
                    </span>
                  )}
                </div>

                {/* Shutter button with Hold-to-Record */}
                <button
                  onPointerDown={(e) => {
                    if (cameraStatus !== 'ready' || isCapturing) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    pressTimerRef.current = setTimeout(() => {
                       startRecording();
                       isRecordingActionRef.current = true;
                    }, 400);
                  }}
                  onPointerUp={(e) => {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                    if (isRecordingActionRef.current) {
                       stopRecording();
                       isRecordingActionRef.current = false;
                    } else {
                       handleCapture();
                    }
                  }}
                  disabled={isCapturing || cameraStatus !== 'ready'}
                  aria-label="Capture photo or hold for video"
                  className={`relative z-20 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-4 border-comic-ink flex items-center justify-center transition-all shadow-comic hover:shadow-comic-hover disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${isRecording ? 'scale-110 shadow-comic-sm' : 'hover:scale-105 active:scale-90'}`}
                >
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 flex items-center justify-center transition-colors ${isRecording ? 'bg-comic-red border-comic-red animate-pulse' : 'bg-comic-pink border-white hover:bg-comic-red'}`}>
                    {isRecording ? (
                       <span className="font-heading font-black text-white text-lg">{recordingTime}s</span>
                    ) : (
                       <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    )}
                  </div>
                  {isCapturing && <div className="absolute inset-0 rounded-full border-4 border-comic-yellow animate-ping" />}
                </button>

                {/* Right tip */}
                <div className="absolute right-0 flex flex-col items-center gap-1 w-[88px] z-10 pointer-events-none">
                  <Video className="w-5 h-5 text-comic-orange" />
                  <p className="text-center text-comic-ink/50 text-[10px] sm:text-xs font-heading font-black leading-tight">
                    Hold for GIF
                  </p>
                  <p className="text-center text-comic-ink/40 text-[9px] font-heading font-bold leading-tight">
                    Tap for Photo
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
