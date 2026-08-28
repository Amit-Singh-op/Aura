'use client';

import React, { useRef, useState } from 'react';

export function SwipeToReply({ onReply, children }: { onReply: () => void, children: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const startY = useRef(0);
  const isHorizontalDrag = useRef<boolean | null>(null);

  // Threshold to trigger the reply action
  const SWIPE_THRESHOLD = 50;
  // Maximum visual drag limit
  const MAX_SWIPE = 80;

  const handleDragStart = (clientX: number, clientY: number) => {
    startX.current = clientX;
    startY.current = clientY;
    setIsDragging(true);
    isHorizontalDrag.current = null;
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const diffX = clientX - startX.current;
    const diffY = clientY - startY.current;

    // Determine if user is scrolling vertically or swiping horizontally
    if (isHorizontalDrag.current === null) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 5) {
        isHorizontalDrag.current = true;
      } else if (Math.abs(diffY) > 5) {
        isHorizontalDrag.current = false;
        setIsDragging(false);
        return;
      } else {
        return;
      }
    }

    if (isHorizontalDrag.current === false) return;
    
    currentX.current = clientX;
    
    if (diffX > 0) {
      const resistance = diffX > SWIPE_THRESHOLD ? 0.3 : 1;
      const newOffset = Math.min(diffX * resistance, MAX_SWIPE);
      setOffset(newOffset);
    } else {
       setOffset(0);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (offset > SWIPE_THRESHOLD) {
      onReply();
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }
    setOffset(0);
    isHorizontalDrag.current = null;
  };

  return (
    <div 
      className="relative flex flex-col items-start touch-pan-y"
      onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleDragEnd}
      onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
      onMouseMove={(e) => {
        if (e.buttons === 1) handleDragMove(e.clientX, e.clientY);
      }}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      <div 
        className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-200 pointer-events-none"
        style={{ 
          opacity: Math.min(offset / SWIPE_THRESHOLD, 1),
          transform: `translate(${Math.min(offset - 40, 0)}px, -50%)`,
          zIndex: 0,
        }}
      >
        <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-full p-2 text-indigo-600 dark:text-indigo-400 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
        </div>
      </div>

      <div 
        className={`z-10 ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
