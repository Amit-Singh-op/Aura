'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Camera, RotateCcw, Send, ChevronLeft, ChevronRight,
  Sparkles, RefreshCcw, AlertCircle, Zap,
} from 'lucide-react';

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
  const isMirrored = useRef(true);

  const [activeFilterIdx,  setActiveFilterIdx]  = useState(0);
  const [activeOverlayIdx, setActiveOverlayIdx] = useState(0);
  const [facingMode,       setFacingMode]       = useState<'user' | 'environment'>('user');
  const [cameraStatus,     setCameraStatus]     = useState<'loading' | 'ready' | 'error'>('loading');
  const [cameraError,      setCameraError]      = useState('');
  const [capturedPhoto,    setCapturedPhoto]    = useState<string | null>(null);
  const [isCapturing,      setIsCapturing]      = useState(false);
  const [showFilters,      setShowFilters]      = useState(true);
  const [filterScroll,     setFilterScroll]     = useState(0);
  const [canFlip,          setCanFlip]          = useState(false);

  const activeFilter  = FILTERS[activeFilterIdx];
  const activeOverlay = AR_OVERLAYS[activeOverlayIdx];
  const VISIBLE = 5;
  const maxScroll = Math.max(0, FILTERS.length - VISIBLE);

  // ── Stop stream & close ────────────────────────────────────────────────────
  // Use a plain object ref so React StrictMode double-invoke can't null it
  // before the real unmount happens.
  const stopStream = useCallback(() => {
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
    return () => {
      // Read directly from DOM to survive StrictMode's double-invoke
      const vid = videoRef.current;
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
        setCameraStatus('ready');
        return;
      } catch (err) {
        const n = err instanceof DOMException ? err.name : '';
        if (['NotAllowedError','PermissionDeniedError','NotFoundError','DevicesNotFoundError','SecurityError'].includes(n) || i === tries.length - 1) {
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

  // ── Canvas capture ────────────────────────────────────────────────────────
  const handleCapture = () => {
    if (!videoRef.current || isCapturing || cameraStatus !== 'ready') return;
    setIsCapturing(true);
    const v = videoRef.current;
    const w = v.videoWidth || 640, h = v.videoHeight || 480;
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d')!;
    if (isMirrored.current) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.filter = activeFilter.cssFilter !== 'none' ? activeFilter.cssFilter : '';
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (activeFilter.tint) { ctx.fillStyle = activeFilter.tint; ctx.fillRect(0, 0, w, h); }
    if (activeFilter.canvasEffect === 'glitch') {
      for (let i = 0; i < 6; i++) {
        try { const y=Math.random()*h, img=ctx.getImageData(0,y,w,18); ctx.putImageData(img,(Math.random()-.5)*40,y); } catch { /**/ }
      }
    } else if (activeFilter.canvasEffect === 'pixelate') {
      const sz=12, t=document.createElement('canvas');
      t.width=Math.max(1,Math.floor(w/sz)); t.height=Math.max(1,Math.floor(h/sz));
      t.getContext('2d')!.drawImage(cvs,0,0,t.width,t.height);
      ctx.imageSmoothingEnabled=false; ctx.drawImage(t,0,0,w,h);
    } else if (activeFilter.canvasEffect === 'vhs') {
      ctx.fillStyle='rgba(0,0,0,0.09)';
      for (let y=0; y<h; y+=4) ctx.fillRect(0,y,w,1);
    }
    if (activeOverlay.id !== 'none' && activeOverlay.emoji) {
      const chars=Array.from(activeOverlay.emoji), fs=Math.min(w*.1,72);
      ctx.font=`${fs}px serif`; ctx.textAlign='center';
      const sp=w/(chars.length+1);
      const yp=activeOverlay.position==='top'?fs+24:activeOverlay.position==='bottom'?h-24:h/2;
      chars.forEach((e,i)=>ctx.fillText(e,sp*(i+1),yp));
    }
    setCapturedPhoto(cvs.toDataURL('image/jpeg', 0.92));
    setIsCapturing(false);
  };

  const handleSend = () => {
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
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-comic-yellow border-2 border-comic-ink rounded-full font-heading font-black text-sm text-comic-ink shadow-comic-sm">
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

          {/* Captured photo */}
          {capturedPhoto && (
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedPhoto} alt="Captured snap" className="w-full h-full object-cover" />
              {/* halftone comic texture overlay */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage:'radial-gradient(rgba(43,27,61,0.035) 1px,transparent 1px)', backgroundSize:'8px 8px' }} />
            </div>
          )}

          {/* Live feed */}
          {!capturedPhoto && (
            <div className="absolute inset-0">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"
                style={{
                  filter: activeFilter.cssFilter !== 'none' ? activeFilter.cssFilter : undefined,
                  transform: isMirrored.current ? 'scaleX(-1)' : undefined,
                  transition: 'filter 0.3s ease',
                  opacity: cameraStatus === 'ready' ? 1 : 0,
                }}
              />
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
                  <video autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
                    style={{ filter:'hue-rotate(180deg) saturate(3)', transform:isMirrored.current?'scaleX(-1) translateX(8px)':'translateX(8px)', mixBlendMode:'screen' }}
                    ref={el => { if (el && streamRef.current) el.srcObject = streamRef.current; }} />
                  <video autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                    style={{ filter:'hue-rotate(-90deg) saturate(2)', transform:isMirrored.current?'scaleX(-1) translateX(-6px)':'translateX(-6px)', mixBlendMode:'screen' }}
                    ref={el => { if (el && streamRef.current) el.srcObject = streamRef.current; }} />
                </>
              )}
              {activeOverlay.id !== 'none' && activeOverlay.emoji && cameraStatus === 'ready' && (
                <div className={`absolute left-0 right-0 pointer-events-none flex justify-around items-center px-6 ${
                  activeOverlay.position === 'top' ? 'top-4' : activeOverlay.position === 'bottom' ? 'bottom-4' : 'top-1/2 -translate-y-1/2'
                }`}>
                  {Array.from(activeOverlay.emoji).map((e, i) => (
                    <span key={i} className="text-6xl sm:text-7xl drop-shadow-[0_3px_12px_rgba(0,0,0,0.5)] animate-bounce"
                      style={{ animationDelay:`${i*0.15}s`, animationDuration:'1.5s' }}>{e}</span>
                  ))}
                </div>
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
          )}
        </div>

        {/* ══ BOTTOM PANEL ════════════════════════════════════════════════ */}
        <div className="shrink-0 bg-comic-bg">

          {capturedPhoto ? (
            /* ── Retake / Send ── */
            <div className="flex items-stretch gap-4 p-4 sm:p-5">
              <button onClick={() => setCapturedPhoto(null)}
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
                      onClick={() => setFilterScroll(i => Math.max(0, i - 1))}
                      disabled={filterScroll === 0}
                      className="shrink-0 w-9 h-9 rounded-xl bg-comic-yellow border-2 border-comic-ink flex items-center justify-center text-comic-ink hover:shadow-comic-sm transition-all active:scale-90 disabled:opacity-0 disabled:pointer-events-none shadow-comic-sm"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    {/* Filter pills */}
                    <div className="flex gap-2 sm:gap-3 flex-1 justify-around overflow-hidden">
                      {FILTERS.slice(filterScroll, filterScroll + VISIBLE).map((f, i) => {
                        const idx = i + filterScroll;
                        const isActive = idx === activeFilterIdx;
                        return (
                          <button
                            key={f.id}
                            onClick={() => setActiveFilterIdx(idx)}
                            className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${
                              isActive ? '-translate-y-1' : 'opacity-65 hover:opacity-90 hover:-translate-y-0.5'
                            }`}
                          >
                            {/* Circle */}
                            <div
                              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 flex items-center justify-center text-2xl sm:text-3xl relative transition-all ${
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
                              className={`font-heading font-black text-[11px] sm:text-xs leading-tight text-center w-12 sm:w-14 truncate transition-colors ${
                                isActive ? 'text-comic-ink' : 'text-comic-ink/60'
                              }`}
                            >
                              {f.label}
                            </span>
                            {/* Active dot */}
                            {isActive && (
                              <div className="w-2 h-2 rounded-full bg-comic-ink -mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* → arrow */}
                    <button
                      onClick={() => setFilterScroll(i => Math.min(maxScroll, i + 1))}
                      disabled={filterScroll >= maxScroll}
                      className="shrink-0 w-9 h-9 rounded-xl bg-comic-yellow border-2 border-comic-ink flex items-center justify-center text-comic-ink hover:shadow-comic-sm transition-all active:scale-90 disabled:opacity-0 disabled:pointer-events-none shadow-comic-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  /* Overlays */
                  <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    {AR_OVERLAYS.map((ov, idx) => {
                      const isActive = idx === activeOverlayIdx;
                      return (
                        <button
                          key={ov.id}
                          onClick={() => setActiveOverlayIdx(idx)}
                          className={`shrink-0 flex flex-col items-center gap-1.5 transition-all duration-200 ${
                            isActive ? '-translate-y-1' : 'opacity-65 hover:opacity-90 hover:-translate-y-0.5'
                          }`}
                        >
                          <div
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 flex items-center justify-center text-2xl sm:text-3xl bg-white relative transition-all ${
                              isActive ? 'border-comic-teal shadow-comic-sm' : 'border-comic-ink/40'
                            }`}
                          >
                            {ov.id === 'none'
                              ? <X className="w-6 h-6 text-comic-ink/50" />
                              : <span className="leading-none">{Array.from(ov.emoji)[0]}</span>
                            }
                            {isActive && (
                              <div className="absolute inset-0 rounded-full border-4 border-comic-teal animate-ping opacity-20" />
                            )}
                          </div>
                          <span className={`font-heading font-black text-[11px] sm:text-xs leading-tight text-center w-12 sm:w-14 truncate ${isActive ? 'text-comic-teal' : 'text-comic-ink/60'}`}>
                            {ov.label}
                          </span>
                          {isActive && (
                            <div className="w-2 h-2 rounded-full bg-comic-teal -mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Shutter row ───────────────────────────────────────── */}
              <div className="flex items-center justify-between">
                {/* Left info pill */}
                <div className="flex flex-col gap-1">
                  <span className="px-3 py-1 bg-comic-purple/15 border-2 border-comic-purple/40 rounded-full font-heading font-black text-xs text-comic-purple">
                    {activeFilter.emoji} {activeFilter.label}
                  </span>
                  {activeOverlay.id !== 'none' && (
                    <span className="px-3 py-1 bg-comic-teal/15 border-2 border-comic-teal/40 rounded-full font-heading font-black text-xs text-comic-teal">
                      {Array.from(activeOverlay.emoji)[0]} {activeOverlay.label}
                    </span>
                  )}
                </div>

                {/* Shutter button */}
                <button
                  onClick={handleCapture}
                  disabled={isCapturing || cameraStatus !== 'ready'}
                  aria-label="Capture photo"
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-4 border-comic-ink flex items-center justify-center hover:scale-105 active:scale-90 transition-all shadow-comic hover:shadow-comic-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-comic-pink border-4 border-white flex items-center justify-center hover:bg-comic-red transition-colors">
                    <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                  {isCapturing && <div className="absolute inset-0 rounded-full border-4 border-comic-yellow animate-ping" />}
                </button>

                {/* Right tip */}
                <div className="flex flex-col items-center gap-1 w-[88px]">
                  <Sparkles className="w-5 h-5 text-comic-orange" />
                  <p className="text-center text-comic-ink/50 text-[10px] sm:text-xs font-heading font-black leading-tight">
                    Tap to capture
                  </p>
                  <p className="text-center text-comic-ink/40 text-[9px] font-heading font-bold leading-tight">
                    & send to chat
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
