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
type TextBlock = { id: string; text: string; x: number; y: number; color: string; size: number; bgColor: string };

export function StickerStudio({ onStickerCreated, onCancel }: StickerStudioProps) {
  const [mode, setMode] = useState<'upload' | 'draw' | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });
  
  // Text Overlay State
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

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

  const addTextBlock = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setTextBlocks(prev => [
      ...prev,
      { id: newId, text: 'NEW TEXT', x: canvasSize.width / 2, y: canvasSize.height / 2, color: '#ffffff', size: 40, bgColor: '#a855f7' }
    ]);
    setSelectedTextId(newId);
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-comic-bg/80 backdrop-blur-sm sm:p-4">
        <div className="flex flex-col items-center justify-center w-full max-w-md h-[100dvh] sm:h-auto text-center p-6 sm:p-8 bg-white border-4 border-comic-ink rounded-none sm:rounded-3xl shadow-comic relative overflow-hidden -rotate-1 hover:rotate-0 transition-all duration-300">
          <div className="w-20 h-20 bg-comic-teal rounded-full flex items-center justify-center text-comic-ink mb-6 border-4 border-comic-ink shadow-comic rotate-6 z-10 relative">
            <Sparkles className="w-10 h-10 font-bold" />
          </div>
          <h3 className="text-3xl font-heading font-black text-comic-ink mb-3 tracking-tight z-10 relative -rotate-2">Sticker Studio</h3>
          <p className="text-lg text-comic-ink/80 font-bold mb-8 max-w-[250px] leading-relaxed z-10 relative">
            How would you like to create your custom sticker?
          </p>
          
          <div className="flex flex-col gap-4 w-full z-10 relative">
            <label className="cursor-pointer bg-comic-pink hover:bg-comic-pink border-4 border-comic-ink text-white shadow-comic rounded-xl px-6 py-4 text-lg font-heading font-black transition-all flex items-center justify-center gap-3 hover:-translate-y-1 hover:shadow-comic-hover uppercase tracking-wider rotate-1">
              <ImagePlus className="w-6 h-6" />
              Upload Base Image
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            
            <button onClick={initializeBlankCanvas} className="bg-comic-yellow hover:bg-comic-yellow border-4 border-comic-ink text-comic-ink shadow-comic rounded-xl px-6 py-4 text-lg font-heading font-black transition-all flex items-center justify-center gap-3 hover:-translate-y-1 hover:shadow-comic-hover uppercase tracking-wider -rotate-1">
              <PenTool className="w-6 h-6" />
              Draw from Scratch
            </button>
          </div>

          {error && <p className="text-sm text-comic-pink mt-4 font-bold bg-comic-pink/20 px-4 py-2 rounded-xl border-4 border-comic-ink z-10 relative">{error}</p>}
          
          <button onClick={onCancel} className="mt-8 text-md font-bold text-comic-ink/60 hover:text-comic-ink hover:underline decoration-4 underline-offset-4 transition-colors z-10 relative">
            Cancel & Close
          </button>
        </div>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
  }

  const editorContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-comic-bg/80 backdrop-blur-sm sm:p-4"
      onPointerDown={() => setSelectedTextId(null)}
    >
      <div className="flex flex-col w-full max-w-2xl bg-white border-4 border-comic-ink rounded-none sm:rounded-3xl shadow-comic p-4 sm:p-6 relative overflow-hidden h-[100dvh] sm:h-[90vh] sm:max-h-[900px]">

        <div className="flex justify-between items-center mb-4 px-2 z-10 relative">
          <h3 className="text-2xl font-heading font-black text-comic-ink flex items-center gap-2 tracking-tight">
            <Sparkles className="w-6 h-6 text-comic-purple" /> Studio Editor
          </h3>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={addTextBlock}
              className="flex items-center gap-2 bg-comic-yellow text-comic-ink border-4 border-comic-ink px-4 py-2 rounded-xl font-heading font-black text-sm shadow-comic-sm hover:-translate-y-1 hover:shadow-comic transition-all"
            >
              <Type className="w-5 h-5" /> Add Text
            </button>

            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border-4 border-comic-ink shadow-comic-sm">
              <input 
                type="color" 
                value={brushColor} 
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-10 h-10 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                title="Brush Color"
              />
              <div className="w-1 h-6 bg-comic-ink/20"></div>
              <button 
                onClick={() => { strokesRef.current = []; drawCanvas(); }}
                className="text-comic-ink hover:text-comic-pink p-1 transition-colors"
                title="Clear Drawing"
              >
                <Eraser className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Canvas & Text Overlay Area */}
        <div className="flex-1 flex items-center justify-center bg-comic-bg/50 rounded-2xl border-4 border-dashed border-comic-ink overflow-hidden relative mb-5 shadow-inner z-10">
          
          <div 
            ref={containerRef}
            className="relative bg-white shadow-comic cursor-crosshair touch-none overflow-hidden border-4 border-comic-ink"
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
                onPointerDown={(e) => { e.stopPropagation(); setSelectedTextId(block.id); }}
                className={`text-block absolute flex flex-col items-center gap-1 p-2 rounded-2xl border-4 backdrop-blur-sm shadow-comic transition-colors z-20 ${selectedTextId === block.id ? 'border-comic-yellow' : 'border-comic-ink'}`}
                style={{ 
                  backgroundColor: block.bgColor,
                  left: `${(block.x / canvasSize.width) * 100}%`, 
                  top: `${(block.y / canvasSize.height) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Text Controls (Only visible when active/dragging) */}
                {selectedTextId === block.id && (
                  <div className="flex items-center gap-2 bg-white rounded-xl px-2 py-1.5 border-2 border-comic-ink shadow-comic-sm mb-1 pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-black uppercase text-comic-ink leading-none">Text</span>
                      <input 
                        type="color" 
                        value={block.color}
                        onChange={(e) => setTextBlocks(prev => prev.map(t => t.id === block.id ? { ...t, color: e.target.value } : t))}
                        className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                        title="Text Color"
                      />
                    </div>
                    <div className="w-px h-6 bg-comic-ink/20 mx-0.5"></div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-black uppercase text-comic-ink leading-none">Box</span>
                      <input 
                        type="color" 
                        value={block.bgColor}
                        onChange={(e) => setTextBlocks(prev => prev.map(t => t.id === block.id ? { ...t, bgColor: e.target.value } : t))}
                        className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                        title="Background Color"
                      />
                    </div>
                    <div className="w-px h-6 bg-comic-ink/20 mx-0.5"></div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-black uppercase text-comic-ink leading-none">Size</span>
                      <input 
                        type="range" min="12" max="120" 
                        value={block.size}
                        onChange={(e) => setTextBlocks(prev => prev.map(t => t.id === block.id ? { ...t, size: parseInt(e.target.value) } : t))}
                        className="w-16 sm:w-24 accent-comic-pink cursor-pointer h-4"
                        title="Text Size"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pointer-events-auto w-full justify-center">
                  <div 
                    className="cursor-move p-2 hover:text-comic-yellow text-white bg-comic-ink/20 rounded-lg backdrop-blur-md"
                    onPointerDown={(e) => { e.preventDefault(); setDraggingTextId(block.id); setSelectedTextId(block.id); }}
                  >
                    <GripHorizontal className="w-5 h-5" />
                  </div>
                  
                  <input 
                    type="text" 
                    value={block.text}
                    onPointerDown={(e) => { e.stopPropagation(); setSelectedTextId(block.id); }}
                    onChange={(e) => setTextBlocks(prev => prev.map(t => t.id === block.id ? { ...t, text: e.target.value } : t))}
                    className="bg-transparent font-heading font-black uppercase outline-none text-center placeholder:text-white/50 min-w-[100px]"
                    style={{ 
                      color: block.color,
                      fontSize: `${block.size}px`,
                      width: `${Math.max(100, block.text.length * (block.size * 0.65))}px`,
                      maxWidth: '80vw',
                      textShadow: '4px 4px 0 #2B1B3D, -2px -2px 0 #2B1B3D, 2px -2px 0 #2B1B3D, -2px 2px 0 #2B1B3D' 
                    }}
                  />
                  
                  <button 
                    onClick={() => removeTextBlock(block.id)}
                    className="p-2 hover:bg-comic-pink text-white bg-comic-red rounded-lg border-2 border-comic-ink shadow-comic-sm transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm font-bold text-comic-pink bg-comic-pink/20 border-4 border-comic-ink p-3 rounded-xl mb-3 px-2 z-10 relative">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 mt-auto z-10 relative">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel} 
            className="flex-1 rounded-xl h-14 text-lg font-heading font-bold text-comic-ink border-4 border-transparent hover:border-comic-ink hover:bg-comic-yellow"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSave}
            disabled={loading} 
            className="flex-1 rounded-xl h-14 text-lg font-heading font-black bg-comic-orange text-comic-ink border-4 border-comic-ink shadow-comic transition-all hover:-translate-y-1 hover:shadow-comic-hover uppercase tracking-wider"
          >
            {loading ? <div className="text-2xl animate-spin">🤡</div> : 'Save Sticker 🎉'}
          </Button>
        </div>
      </div>
    </div>
  );
  
  return typeof document !== 'undefined' ? createPortal(editorContent, document.body) : editorContent;
}
