'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2, Sparkles, PenTool, Eraser, Type, GripHorizontal, Trash2 } from 'lucide-react';
import { Sticker } from '@/lib/storage/types';

interface StickerStudioProps {
  onStickerCreated: (sticker: Sticker) => void;
  onCancel: () => void;
}

type Point = { x: number; y: number };
type Stroke = { color: string; width: number; points: Point[] };
type TextBlock = { id: string; text: string; x: number; y: number };

export function StickerStudio({ onStickerCreated, onCancel }: StickerStudioProps) {
  const [mode, setMode] = useState<'upload' | 'draw' | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });
  
  // Text Overlay State
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Paint State
  const isDrawing = useRef(false);
  const [brushColor, setBrushColor] = useState('#a855f7');
  const [brushSize, setBrushSize] = useState(6);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStroke = useRef<Point[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Initialize Blank Canvas
  const initializeBlankCanvas = () => {
    setCanvasSize({ width: 600, height: 600 });
    setMode('draw');
  };

  // Handle base image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be under 5MB');
        return;
      }
      const url = URL.createObjectURL(file);
      setBaseImage(url);
      
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        const MAX_SIZE = 600;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX_SIZE) { h = h * (MAX_SIZE / w); w = MAX_SIZE; }
        } else {
          if (h > MAX_SIZE) { w = w * (MAX_SIZE / h); h = MAX_SIZE; }
        }
        setCanvasSize({ width: w, height: h });
        setMode('upload');
      };
      img.src = url;
    }
  };

  // The main render function (only draws image and strokes, NOT HTML text overlays)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear Canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // 2. Draw Image (if any)
    const img = imageRef.current;
    if (img && mode === 'upload') {
      ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);
    }

    // 3. Replay Strokes (Paint)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokesRef.current.forEach(stroke => {
      if (stroke.points.length === 0) return;
      
      // Add neon glow effect to the brush
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = 12;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Draw the active stroke currently being drawn
    if (currentStroke.current.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.moveTo(currentStroke.current[0].x, currentStroke.current[0].y);
      for (let i = 1; i < currentStroke.current.length; i++) {
        ctx.lineTo(currentStroke.current[i].x, currentStroke.current[i].y);
      }
      ctx.stroke();
    }
  }, [mode, brushColor, brushSize, canvasSize]);

  useEffect(() => {
    if (mode) drawCanvas();
  }, [drawCanvas, mode]);


  // --- Pointer Event Handlers (Unifies Mouse & Touch) ---
  const getCanvasPos = (e: React.PointerEvent | PointerEvent) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    
    const scaleX = canvasSize.width / rect.width;
    const scaleY = canvasSize.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // If we clicked on a text block or its drag handle, don't start drawing
    if ((e.target as HTMLElement).closest('.text-block')) return;

    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
    
    isDrawing.current = true;
    const pos = getCanvasPos(e);
    currentStroke.current = [pos];
    drawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    
    // Handle Text Dragging
    if (draggingTextId) {
      const pos = getCanvasPos(e);
      setTextBlocks(prev => prev.map(t => t.id === draggingTextId ? { ...t, x: pos.x, y: pos.y } : t));
      return;
    }

    // Handle Drawing
    if (isDrawing.current) {
      const pos = getCanvasPos(e);
      currentStroke.current.push(pos);
      drawCanvas(); // Live render
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
    
    if (draggingTextId) {
      setDraggingTextId(null);
      return;
    }

    if (isDrawing.current) {
      isDrawing.current = false;
      if (currentStroke.current.length > 0) {
        strokesRef.current.push({ color: brushColor, width: brushSize, points: [...currentStroke.current] });
        currentStroke.current = [];
        drawCanvas();
      }
    }
  };
  // ----------------------------------------

  // Text Management
  const addTextBlock = () => {
    setTextBlocks(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), text: 'NEW TEXT', x: canvasSize.width / 2, y: canvasSize.height / 2 }
    ]);
  };

  const removeTextBlock = (id: string) => {
    setTextBlocks(prev => prev.filter(t => t.id !== id));
  };


  const autoCropCanvas = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;
    
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const imgData = ctx.getImageData(0, 0, width, height).data;
    
    let minX = width, minY = height, maxX = 0, maxY = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = imgData[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    if (minX > maxX || minY > maxY) return sourceCanvas;
    
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width, maxX + padding);
    maxY = Math.min(height, maxY + padding);
    
    const croppedWidth = maxX - minX;
    const croppedHeight = maxY - minY;
    
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = croppedWidth;
    cropCanvas.height = croppedHeight;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return sourceCanvas;
    
    cropCtx.drawImage(sourceCanvas, minX, minY, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
    return cropCanvas;
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setError('');

    // Rasterize HTML Text Blocks onto the canvas before saving
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Temporarily disable glow for text rasterization to keep it sharp
      ctx.shadowBlur = 0;
      
      const fontSize = Math.floor(canvasSize.height / 8);
      ctx.font = `900 ${fontSize}px Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = Math.max(2, fontSize / 10);
      ctx.lineJoin = 'round';

      textBlocks.forEach(block => {
        if (!block.text.trim()) return;
        ctx.strokeText(block.text.toUpperCase(), block.x, block.y);
        ctx.fillText(block.text.toUpperCase(), block.x, block.y);
      });
    }

    const finalCanvas = autoCropCanvas(canvas);

    finalCanvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Failed to process image');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      const file = new File([blob], `custom_sticker.png`, { type: 'image/png' });
      formData.append('file', file);
      formData.append('name', `Sticker_${Math.floor(Math.random()*1000)}`);

      try {
        const res = await fetch('/api/stickers', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || 'Failed to save sticker');
        } else {
          onStickerCreated(data);
        }
      } catch (err) {
        setError('An error occurred while saving.');
      } finally {
        setLoading(false);
      }
    }, 'image/png');
  };

  if (!mode) {
    const modalContent = (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
        <div className="flex flex-col items-center justify-center w-full max-w-md h-[100dvh] sm:h-auto text-center p-6 sm:p-8 bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-700/50 rounded-none sm:rounded-[2rem] shadow-2xl relative overflow-hidden">
          {/* Animated Background Blob */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[80px] rounded-full"></div>
            <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-purple-500/10 blur-[80px] rounded-full"></div>
          </div>
          
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-xl shadow-indigo-500/20 z-10 relative">
            <Sparkles className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-3 tracking-tight z-10 relative">Sticker Studio</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-[250px] leading-relaxed z-10 relative">
            How would you like to create your custom sticker?
          </p>
          
          <div className="flex flex-col gap-4 w-full z-10 relative">
            <label className="cursor-pointer bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-full px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 hover:scale-105">
              <ImagePlus className="w-5 h-5" />
              Upload Base Image
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            
            <button onClick={initializeBlankCanvas} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 rounded-full px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 shadow-md transition-all flex items-center justify-center gap-3 hover:scale-105">
              <PenTool className="w-5 h-5" />
              Draw from Scratch
            </button>
          </div>

          {error && <p className="text-xs text-red-500 mt-4 font-medium z-10 relative">{error}</p>}
          
          <button onClick={onCancel} className="mt-8 text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10 relative">
            Cancel & Close
          </button>
        </div>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
  }

  const editorContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
      <div className="flex flex-col w-full max-w-2xl bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-700/50 rounded-none sm:rounded-[2rem] shadow-2xl p-4 sm:p-6 relative overflow-hidden h-[100dvh] sm:h-[90vh] sm:max-h-[900px]">
        
        {/* Animated Background Blob */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[100px] rounded-full"></div>
        </div>

        <div className="flex justify-between items-center mb-4 px-2 z-10 relative">
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 tracking-tight">
            <Sparkles className="w-5 h-5 text-purple-500" /> Studio Editor
          </h3>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={addTextBlock}
              className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800"
            >
              <Type className="w-4 h-4" /> Add Text
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <input 
                type="color" 
                value={brushColor} 
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                title="Brush Color"
              />
              <div className="w-px h-5 bg-slate-300 dark:bg-slate-600"></div>
              <button 
                onClick={() => { strokesRef.current = []; drawCanvas(); }}
                className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                title="Clear Drawing"
              >
                <Eraser className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Canvas & Text Overlay Area */}
        <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-950/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden relative mb-5 shadow-inner z-10">
          
          <div 
            ref={containerRef}
            className="relative bg-white dark:bg-black shadow-lg cursor-crosshair touch-none overflow-hidden"
            style={{ 
              aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
              height: '100%',
              maxHeight: '100%',
              maxWidth: '100%'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <canvas 
              ref={canvasRef} 
              width={canvasSize.width} 
              height={canvasSize.height}
              className="w-full h-full pointer-events-none" 
            />

            {/* Draggable Text Blocks */}
            {textBlocks.map(block => (
              <div 
                key={block.id}
                className={`text-block absolute flex items-center gap-2 p-1.5 rounded-lg border-2 bg-black/40 backdrop-blur-md shadow-xl transition-colors ${draggingTextId === block.id ? 'border-indigo-400' : 'border-transparent hover:border-white/30'}`}
                style={{ 
                  left: `${(block.x / canvasSize.width) * 100}%`, 
                  top: `${(block.y / canvasSize.height) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div 
                  className="cursor-move p-1 text-white/70 hover:text-white"
                  onPointerDown={(e) => { e.preventDefault(); setDraggingTextId(block.id); }}
                >
                  <GripHorizontal className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={block.text}
                  onChange={(e) => setTextBlocks(prev => prev.map(t => t.id === block.id ? { ...t, text: e.target.value } : t))}
                  className="bg-transparent text-white font-black uppercase text-2xl outline-none w-[150px] text-center"
                  style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
                />
                <button 
                  onClick={() => removeTextBlock(block.id)}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-3 px-2 font-medium z-10 relative">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 mt-auto z-10 relative">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel} 
            className="flex-1 rounded-full h-12 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSave}
            disabled={loading} 
            className="flex-1 rounded-full h-12 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Sticker'}
          </Button>
        </div>
      </div>
    </div>
  );
  
  return typeof document !== 'undefined' ? createPortal(editorContent, document.body) : editorContent;
}
