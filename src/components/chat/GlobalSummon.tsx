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

      const customMsg = data.message.replace(/#all/gi, '').trim();

      if (customMsg && 'speechSynthesis' in window) {
        // Play custom message using SpeechSynthesis in a slow, funky voice
        const utterance = new SpeechSynthesisUtterance(customMsg);
        utterance.pitch = 0.4; // Funky deep voice
        utterance.rate = 0.75; // Slow motion but clearly understandable
        utterance.volume = 1.0;
        
        // Try to pick a cool voice if available
        const voices = window.speechSynthesis.getVoices();
        const funkyVoice = voices.find(v => v.name.includes('Daniel') || v.name.includes('UK English') || v.name.includes('Google UK English Male'));
        if (funkyVoice) {
          utterance.voice = funkyVoice;
        }

        window.speechSynthesis.speak(utterance);
      } else if (!customMsg) {      // Play default synthetic siren
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
      }

      // Show OS Notification if tab is hidden
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const customMsg = data.message.replace(/#all/gi, '').trim();
          const bodyText = customMsg 
            ? `${data.username} says: "${customMsg}"\nThey are summoning everyone to ${data.roomName}!` 
            : `${data.username} is summoning everyone to ${data.roomName}!`;

          const notification = new Notification('🚨 WAKE UP! 🤡', {
            body: bodyText,
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
        className="animate-wiggle bg-comic-yellow border-8 border-comic-red rounded-[40px] p-8 sm:p-12 max-w-3xl text-center shadow-[16px_16px_0px_0px_#FF2A4C] cursor-pointer hover:scale-110 transition-transform animate-pulse saturate-[200%] contrast-125 drop-shadow-[0_0_50px_rgba(255,42,76,0.8)]"
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
        <p className="font-bold text-2xl sm:text-3xl text-comic-ink mb-6 leading-snug">
          <span className="text-comic-pink bg-white px-2 py-1 rounded-lg border-2 border-comic-ink">{summonEvent.username}</span> is summoning EVERYONE to <br/>
          <span className="text-comic-purple font-black text-4xl mt-4 block">{summonEvent.roomName}</span>
        </p>

        {(() => {
          const customMsg = summonEvent.message.replace(/#all/gi, '').trim();
          if (!customMsg) return null;
          return (
            <div className="bg-white border-4 border-comic-ink p-4 sm:p-6 rounded-2xl mb-8 transform -rotate-1 shadow-comic relative max-w-xl mx-auto w-full">
              <div className="absolute -top-3 left-4 bg-comic-yellow px-2 py-1 border-2 border-comic-ink rounded-lg text-xs font-black uppercase tracking-wider transform -rotate-6">Alert Message</div>
              <p className="font-bold text-xl sm:text-2xl text-comic-ink whitespace-pre-wrap break-words mt-2 text-left">
                &quot;{customMsg}&quot;
              </p>
            </div>
          );
        })()}

        <div className="inline-block bg-comic-pink text-white font-black text-3xl px-8 py-4 rounded-full border-4 border-comic-ink shadow-comic-hover transform hover:scale-110 transition-transform animate-pulse">
          JOIN NOW! 🏃💨
        </div>
      </div>
    </div>
  );
}
