'use client';
import { useEffect, useState } from 'react';

export interface BulletShowerProps {
  id: string;
  emoji: string;
  text: string; // The targeted username, e.g. "@ab"
  onComplete: (id: string) => void;
}

export function BulletShower({ id, emoji, text, onComplete }: BulletShowerProps) {
  const [particles, setParticles] = useState<{ id: number, y: number, delay: number, duration: number, size: number, direction: 1 | -1 }[]>([]);

  useEffect(() => {
    // Generate multiple particles to create a "bullet" barrage effect
    const newParticles = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      y: 10 + Math.random() * 80, // Random vertical position (10% to 90% vh)
      delay: Math.random() * 0.5, // Start quickly
      duration: 0.8 + Math.random() * 1.5, // 0.8s to 2.3s travel time (bullet speed)
      size: 2 + Math.random() * 3, // Large emojis (2rem to 5rem)
      direction: (Math.random() > 0.5 ? 1 : -1) as 1 | -1, // Left to right (1) or right to left (-1)
    }));
    setParticles(newParticles);

    // Unmount and clean up after the longest animation (approx 3 seconds)
    const timeout = setTimeout(() => {
      onComplete(id);
    }, 3500);

    return () => clearTimeout(timeout);
  }, [id, onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={p.id}
          className="absolute flex items-center gap-2 whitespace-nowrap font-black tracking-tighter drop-shadow-2xl"
          style={{
            top: `${p.y}vh`,
            [p.direction === 1 ? 'left' : 'right']: '-20vw',
            fontSize: `clamp(1.5rem, ${p.size}vw + 1rem, 4rem)`,
            animation: `bulletFly${p.direction === 1 ? 'Right' : 'Left'} ${p.duration}s linear ${p.delay}s forwards`,
            willChange: 'transform, opacity',
          } as React.CSSProperties}
        >
          {p.direction === 1 ? (
            <>
              <span>{emoji}</span>
            </>
          ) : (
            <>
              <span>{emoji}</span>
            </>
          )}
        </div>
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bulletFlyRight {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% {
            transform: translateX(140vw);
            opacity: 0;
          }
        }
        @keyframes bulletFlyLeft {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% {
            transform: translateX(-140vw);
            opacity: 0;
          }
        }
      `}} />
    </div>
  );
}
