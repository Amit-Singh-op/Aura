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
    <div className="fixed inset-x-0 bottom-0 sm:absolute sm:bottom-[calc(100%+1rem)] sm:inset-x-auto sm:left-0 w-full sm:w-[350px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col z-50">
      
      {/* Header Tabs */}
      <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 z-10 relative">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('emoji')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'emoji' 
                ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Emojis
          </button>
          <button
            onClick={() => setActiveTab('stickers')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'stickers' 
                ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Stickers & GIFs
          </button>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 transition-colors">
          <X className="w-4 h-4" />
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
          <div className="h-full flex flex-col p-4 overflow-y-auto bg-slate-50 dark:bg-slate-950/50">
            {!isCreating && (
              <div className="flex gap-3 mb-4">
                <button 
                  onClick={() => setIsCreating(true)}
                  className="flex-1 py-3 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex flex-col items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-slate-700 hover:border-indigo-400 transition-all shadow-sm"
                >
                  <ImagePlus className="w-5 h-5" /> Upload File
                </button>
                <button 
                  onClick={() => setShowStudio(true)}
                  className="flex-1 py-3 rounded-2xl border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 font-semibold text-xs flex flex-col items-center justify-center gap-2 hover:bg-purple-100 dark:hover:bg-slate-700 shadow-sm transition-all"
                >
                  <Palette className="w-5 h-5" /> Open Studio
                </button>
              </div>
            )}

            {isCreating && (
              <form onSubmit={handleCreateSticker} className="mb-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 w-full text-left ml-1">Upload Image or GIF</h4>
                
                <label className={`w-full relative flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${previewUrl ? 'border-transparent' : 'border-indigo-300 dark:border-slate-600 hover:bg-indigo-50/50 dark:hover:bg-slate-800/50 bg-white/60 dark:bg-slate-950/40'}`}>
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-contain rounded-xl" />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500 dark:text-slate-400">
                      <ImagePlus className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs font-medium">Click to select file</p>
                    </div>
                  )}
                  <input type="file" accept="image/*,image/gif" className="hidden" onChange={handleFileChange} />
                </label>

                {error && <p className="text-xs text-red-500 mt-3 w-full text-left ml-1">{error}</p>}
                
                <div className="flex gap-2 w-full mt-4">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setIsCreating(false); setSelectedFile(null); setPreviewUrl(null); }} className="flex-1 rounded-full h-10 text-xs font-semibold">Cancel</Button>
                  <Button type="submit" size="sm" disabled={!selectedFile || loading} className="flex-1 rounded-full h-10 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload & Save'}
                  </Button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-3 gap-3">
              {stickers.map(sticker => (
                <button
                  key={sticker.id}
                  onClick={() => onStickerSelect(sticker)}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-lg transition-all group bg-white dark:bg-slate-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sticker.url} alt={sticker.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Sparkles className="w-6 h-6" />
                  </div>
                </button>
              ))}
            </div>
            
            {stickers.length === 0 && !isCreating && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">No stickers yet.</p>
                <p className="text-xs">Create one or save from chat!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
