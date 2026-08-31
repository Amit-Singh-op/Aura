'use client';
import { useState, useEffect } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2, Sparkles, X, Palette } from 'lucide-react';
import { Sticker } from '@/lib/storage/types';
import { StickerStudio } from './StickerStudio';

interface MediaPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (sticker: Sticker) => void;
  onClose: () => void;
}

export function MediaPicker({ onEmojiSelect, onStickerSelect, onClose }: MediaPickerProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'stickers'>('emoji');
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'stickers') {
      fetchStickers();
    }
  }, [activeTab]);

  const fetchStickers = async () => {
    try {
      const res = await fetch('/api/stickers');
      const data = await res.json();
      if (Array.isArray(data)) {
        setStickers(data);
      }
    } catch (err) {
      console.error('Failed to fetch stickers', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File must be smaller than 5MB');
        return;
      }
      setSelectedFile(file);
      setError('');
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleCreateSticker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', selectedFile.name);

    try {
      const res = await fetch('/api/stickers', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create sticker');
      } else {
        setStickers([data, ...stickers]);
        setIsCreating(false);
        setSelectedFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop for closing */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="fixed inset-x-0 bottom-0 sm:absolute sm:bottom-[calc(100%+1rem)] sm:inset-x-auto sm:left-0 w-full sm:w-[350px] bg-comic-bg border-4 border-comic-ink shadow-comic rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col z-50">
      
      {/* Header Tabs */}
      <div className="flex items-center justify-between p-2 border-b-4 border-comic-ink bg-comic-teal/20 z-10 relative">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('emoji')}
            className={`px-4 py-1.5 rounded-xl font-heading text-sm font-bold transition-all border-2 ${
              activeTab === 'emoji' 
                ? 'bg-comic-yellow border-comic-ink text-comic-ink shadow-comic-sm' 
                : 'border-transparent text-comic-ink/70 hover:text-comic-ink hover:bg-comic-yellow/30'
            }`}
          >
            Emojis
          </button>
          <button
            onClick={() => setActiveTab('stickers')}
            className={`px-4 py-1.5 rounded-xl font-heading text-sm font-bold transition-all border-2 ${
              activeTab === 'stickers' 
                ? 'bg-comic-yellow border-comic-ink text-comic-ink shadow-comic-sm' 
                : 'border-transparent text-comic-ink/70 hover:text-comic-ink hover:bg-comic-yellow/30'
            }`}
          >
            Stickers & GIFs
          </button>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full border-2 border-transparent hover:border-comic-ink hover:bg-comic-pink text-comic-ink hover:text-white transition-all">
          <X className="w-5 h-5 font-bold" />
        </button>
      </div>

      {/* Content Area */}
      <div className="h-[350px] overflow-hidden">
        {activeTab === 'emoji' ? (
          <div className="h-full w-full custom-emoji-picker">
            <EmojiPicker 
              onEmojiClick={(emojiData) => onEmojiSelect(emojiData.emoji)}
              theme={Theme.DARK}
              width="100%"
              height="100%"
              searchDisabled={false}
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
            />
          </div>
        ) : showStudio ? (
          <StickerStudio 
            onStickerCreated={(sticker) => {
              setStickers([sticker, ...stickers]);
              setShowStudio(false);
            }}
            onCancel={() => setShowStudio(false)}
          />
        ) : (
          <div className="h-full flex flex-col p-4 overflow-y-auto bg-comic-bg">
            {!isCreating && (
              <div className="flex gap-3 mb-4">
                <button 
                  onClick={() => setIsCreating(true)}
                  className="flex-1 py-3 rounded-2xl border-4 border-comic-ink bg-comic-purple text-white font-heading font-black text-sm flex flex-col items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-comic transition-all shadow-comic-sm"
                >
                  <ImagePlus className="w-6 h-6" /> Upload File
                </button>
                <button 
                  onClick={() => setShowStudio(true)}
                  className="flex-1 py-3 rounded-2xl border-4 border-comic-ink bg-comic-pink text-white font-heading font-black text-sm flex flex-col items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-comic transition-all shadow-comic-sm"
                >
                  <Palette className="w-6 h-6" /> Open Studio
                </button>
              </div>
            )}

            {isCreating && (
              <form onSubmit={handleCreateSticker} className="mb-4 p-4 rounded-2xl bg-comic-yellow/30 border-4 border-comic-ink shadow-comic flex flex-col items-center">
                <h4 className="text-sm font-heading font-bold text-comic-ink mb-3 w-full text-left">Upload Image or GIF</h4>
                
                <label className={`w-full relative flex flex-col items-center justify-center h-32 rounded-2xl border-4 cursor-pointer transition-all ${previewUrl ? 'border-comic-ink bg-white' : 'border-dashed border-comic-ink hover:bg-comic-yellow bg-white/60'}`}>
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-contain rounded-xl" />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-comic-ink">
                      <ImagePlus className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs font-bold font-heading">Click to select file</p>
                    </div>
                  )}
                  <input type="file" accept="image/*,image/gif" className="hidden" onChange={handleFileChange} />
                </label>

                {error && <p className="text-xs font-bold text-comic-pink mt-3 w-full text-left">{error}</p>}
                
                <div className="flex gap-2 w-full mt-4">
                  <Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setSelectedFile(null); setPreviewUrl(null); }} className="flex-1 rounded-xl h-10 border-2 border-transparent hover:border-comic-ink font-bold text-comic-ink">Cancel</Button>
                  <Button type="submit" disabled={!selectedFile || loading} className="flex-1 rounded-xl h-10 border-2 border-comic-ink bg-comic-orange text-comic-ink font-bold shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all">
                    {loading ? <div className="text-lg animate-spin">🤡</div> : 'Upload & Save'}
                  </Button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-3 gap-3 pb-6">
              {stickers.map(sticker => (
                <button
                  key={sticker.id}
                  onClick={() => onStickerSelect(sticker)}
                  className="relative aspect-square rounded-2xl overflow-hidden border-4 border-comic-ink shadow-comic-sm hover:-translate-y-1 hover:shadow-comic transition-all group bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sticker.url} alt={sticker.name} className="w-full h-full object-cover p-1" />
                  <div className="absolute inset-0 bg-comic-teal/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-comic-ink">
                    <Sparkles className="w-8 h-8 font-bold" />
                  </div>
                </button>
              ))}
            </div>
            
            {stickers.length === 0 && !isCreating && (
              <div className="flex-1 flex flex-col items-center justify-center text-comic-ink font-heading">
                <Sparkles className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-lg font-bold">No stickers yet.</p>
                <p className="text-sm">Create one or save from chat! 🎪</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
