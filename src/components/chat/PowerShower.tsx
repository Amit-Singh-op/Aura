'use client';
import { useEffect, useState } from 'react';

export interface PowerShowerProps {
  id: string;
  text: string;
  textColor: string;
  bgColor: string;
  onComplete: (id: string) => void;
}

export function PowerShower({ id, text, textColor, bgColor, onComplete }: PowerShowerProps) {
  const [particles, setParticles] = useState<{ id: number, x: number, delay: number, duration: number, size: number, rotate: number }[]>([]);

  useEffect(() => {
    // Generate 25 particles for a smooth, lag-free shower
    const newParticles = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // 0 to 100 vw
      delay: Math.random() * 1.5, // stagger start times up to 1.5s
      duration: 2.5 + Math.random() * 2, // 2.5s to 4.5s fall time
      size: 1 + Math.random() * 2.5, // 1rem to 3.5rem
      rotate: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540), // spin between 180 and 720 degrees, random direction
    }));
    setParticles(newParticles);

    // Unmount and clean up after the longest animation
    const timeout = setTimeout(() => {
      onComplete(id);
    }, 6500);

    return () => clearTimeout(timeout);
  }, [id, onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute font-black tracking-tighter"
          style={{
            top: '-10%',
            left: `${p.x}vw`,
            fontSize: `${p.size}rem`,
            color: textColor,
            backgroundColor: bgColor === 'transparent' ? 'transparent' : bgColor,
            padding: bgColor !== 'transparent' ? '0.2em 0.4em' : '0',
            borderRadius: bgColor !== 'transparent' ? '0.5em' : '0',
            border: bgColor !== 'transparent' ? '4px solid #2B1B3D' : 'none',
            boxShadow: bgColor !== 'transparent' ? '4px 4px 0px #2B1B3D' : 'none',
            fontFamily: 'var(--font-heading)',
            textShadow: bgColor === 'transparent' ? `4px 4px 0px #2B1B3D` : '4px 4px 0px #2B1B3D',
            WebkitTextStroke: '2px #2B1B3D',
            animation: `powerFall ${p.duration}s ease-in ${p.delay}s forwards`,
            willChange: 'transform, opacity',
            '--end-rotate': `${p.rotate}deg`,
          } as React.CSSProperties}
        >
          {text}
        </div>
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes powerFall {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(10vh) rotate(calc(var(--end-rotate) * 0.1)) scale(1.1);
          }
          20% {
            transform: translateY(20vh) rotate(calc(var(--end-rotate) * 0.2)) scale(1);
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(120vh) rotate(var(--end-rotate)) scale(1);
            opacity: 0;
          }
        }
      `}} />
    </div>
  );
}
