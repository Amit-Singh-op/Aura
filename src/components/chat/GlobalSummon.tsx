'use client';
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useChatStore } from '@/store/chatStore';

export function GlobalSummon({ socket }: { socket: Socket | null }) {
  const [summonEvent, setSummonEvent] = useState<{ roomId: string; roomName: string; username: string; message: string } | null>(null);
  const setActiveRoomId = useChatStore(state => state.setActiveRoomId);

  useEffect(() => {
    // Request notification permission if it's default (not granted or denied yet)
    // Some browsers require this to be triggered by a user gesture, but we can try on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Just quietly request, if it fails because it's not a user gesture, that's okay
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleSummon = (data: { roomId: string; roomName: string; username: string; message: string }) => {
      const currentUser = useChatStore.getState().currentUser;
      if (currentUser?.username === data.username) return;

      setSummonEvent(data);

      // Play crazy siren audio using AudioContext
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Siren effect
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        oscillator.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.6);
        oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.9);
        oscillator.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 1.2);
        oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 1.5);

        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.1); // Slightly lower volume
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.8);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 2.0);
      } catch (e) {
        console.error("Audio play failed:", e);
      }

      // Show OS Notification if tab is hidden
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notification = new Notification('🚨 WAKE UP! 🤡', {
            body: `${data.username} is summoning everyone to ${data.roomName}!`,
            icon: '/favicon.ico',
          });
          notification.onclick = () => {
            window.focus();
            setActiveRoomId(data.roomId);
            notification.close();
          };
        } catch (e) {
          console.error("Notification failed:", e);
        }
      }

      // Auto-hide the on-screen alert after 6 seconds
      setTimeout(() => {
        setSummonEvent(null);
      }, 6000);
    };

    socket.on('global_summon', handleSummon);

    return () => {
      socket.off('global_summon', handleSummon);
    };
  }, [socket, setActiveRoomId]);

  if (!summonEvent) return null;

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-auto flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="animate-wiggle bg-comic-yellow border-8 border-comic-ink rounded-[40px] p-8 sm:p-12 max-w-3xl text-center shadow-[16px_16px_0px_0px_#2B1B3D] cursor-pointer"
        onClick={() => {
          setActiveRoomId(summonEvent.roomId);
          setSummonEvent(null);
        }}
      >
        <div className="text-8xl sm:text-9xl mb-6 animate-bounce">🚨📢🤡</div>
        <h1 
          className="font-heading font-black text-5xl sm:text-7xl lg:text-8xl uppercase tracking-widest text-comic-red mb-6 leading-none"
          style={{
            WebkitTextStroke: '2px #2B1B3D',
            textShadow: '4px 4px 0 #2B1B3D'
          }}
        >
          WAKE UP!
        </h1>
        <p className="font-bold text-2xl sm:text-3xl text-comic-ink mb-8 leading-snug">
          <span className="text-comic-pink bg-white px-2 py-1 rounded-lg border-2 border-comic-ink">{summonEvent.username}</span> is summoning EVERYONE to <br/>
          <span className="text-comic-purple font-black text-4xl mt-4 block">{summonEvent.roomName}</span>
        </p>
        <div className="inline-block bg-comic-pink text-white font-black text-3xl px-8 py-4 rounded-full border-4 border-comic-ink shadow-comic-hover transform hover:scale-110 transition-transform animate-pulse">
          JOIN NOW! 🏃💨
        </div>
      </div>
    </div>
  );
}
