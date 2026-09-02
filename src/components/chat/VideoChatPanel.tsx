'use client';
import React from 'react';
import { X, Video, VideoOff, Mic, MicOff, RefreshCcw } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { useVideoChat } from '@/hooks/useVideoChat';

interface VideoChatPanelProps {
  socket: Socket;
  roomId: string;
  userId: string;
  username: string;
  onClose: () => void;
}

export const VideoChatPanel: React.FC<VideoChatPanelProps> = ({ socket, roomId, userId, username, onClose }) => {
  const { localStream, participants, isMuted, isVideoOff, facingMode, toggleMute, toggleVideo, flipCamera } = useVideoChat({
    roomId,
    userId,
    username,
    socket,
    isActive: true,
  });

  const [hasConnected, setHasConnected] = React.useState(false);

  React.useEffect(() => {
    if (participants.length > 0) {
      setHasConnected(true);
    }
  }, [participants.length]);

  React.useEffect(() => {
    if (hasConnected && participants.length === 0) {
      onClose();
    }
  }, [hasConnected, participants.length, onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-full bg-comic-bg border-4 border-comic-ink rounded-3xl overflow-hidden shadow-comic flex flex-col transform transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-comic-teal border-b-4 border-comic-ink relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-comic-yellow rounded-full border-4 border-comic-ink opacity-50 z-0 pointer-events-none"></div>
          <div className="absolute bottom-[-10px] left-[20%] w-12 h-12 bg-comic-pink rounded-full border-4 border-comic-ink opacity-50 z-0 pointer-events-none"></div>
          
          <h2 className="text-2xl font-black font-heading text-comic-ink tracking-wide z-10 uppercase flex items-center gap-3">
            <Video className="w-7 h-7 text-comic-ink fill-comic-ink" />
            Live Video Call
          </h2>
          <button 
            onClick={onClose} 
            className="z-10 p-2 rounded-xl bg-comic-red border-2 border-comic-ink shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all active:translate-y-1 active:shadow-none"
            title="End Call"
          >
            <X className="w-6 h-6 text-white font-bold" />
          </button>
        </div>

        {/* Video Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 bg-comic-yellow/20" style={{ maxHeight: '65vh' }}>
          
          {/* Local Participant */}
          <div className="relative flex flex-col bg-white border-4 border-comic-ink rounded-2xl shadow-comic overflow-hidden h-[300px]">
            <div className="absolute top-3 left-3 z-10 px-3 py-1 bg-comic-pink text-comic-ink font-black text-sm uppercase rounded-full border-2 border-comic-ink shadow-comic-sm">
              You
            </div>
            {localStream && !isVideoOff ? (
              <video
                autoPlay
                muted
                playsInline
                ref={(el) => { if (el && localStream) el.srcObject = localStream; }}
                className="w-full h-full object-cover"
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
                <VideoOff className="w-16 h-16 text-slate-300 mb-2" />
                <span className="font-bold text-slate-400 font-heading">Camera Off</span>
              </div>
            )}
            {isMuted && (
              <div className="absolute top-3 right-3 z-10 p-2 bg-comic-red text-white rounded-full border-2 border-comic-ink shadow-comic-sm">
                <MicOff className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Remote Participants */}
          {participants.map((p) => (
            <div key={p.id} className="relative flex flex-col bg-white border-4 border-comic-ink rounded-2xl shadow-comic overflow-hidden h-[300px]">
              <div className="absolute top-3 left-3 z-10 px-3 py-1 bg-comic-teal text-comic-ink font-black text-sm uppercase rounded-full border-2 border-comic-ink shadow-comic-sm">
                {p.username || 'Friend'}
              </div>
              {p.stream ? (
                <video
                  autoPlay
                  playsInline
                  ref={(el) => { if (el && p.stream) el.srcObject = p.stream; }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100">
                  <VideoOff className="w-16 h-16 text-slate-300 mb-2" />
                  <span className="font-bold text-slate-400 font-heading">{p.username ? `${p.username} is observing` : 'Observer'}</span>
                </div>
              )}
            </div>
          ))}

          {/* Empty State placeholder if alone */}
          {participants.length === 0 && (
             <div className="relative flex flex-col items-center justify-center bg-comic-purple/10 border-4 border-dashed border-comic-purple/30 rounded-2xl h-[300px] text-center p-6">
                <span className="text-4xl mb-4">👀</span>
                <h3 className="text-xl font-black font-heading text-comic-ink opacity-70">Waiting for others...</h3>
                <p className="text-sm font-bold text-comic-ink/50 mt-2">The party hasn&apos;t started yet.</p>
             </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 py-6 bg-white border-t-4 border-comic-ink relative z-10">
          <button
            onClick={toggleMute}
            className={`flex items-center justify-center p-4 rounded-full border-4 border-comic-ink shadow-comic transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none ${
              isMuted ? 'bg-comic-red' : 'bg-comic-yellow'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-comic-ink" />}
          </button>
          
          <button
            onClick={toggleVideo}
            className={`flex items-center justify-center p-4 rounded-full border-4 border-comic-ink shadow-comic transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none ${
              isVideoOff ? 'bg-comic-red' : 'bg-comic-teal'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff className="w-8 h-8 text-white" /> : <Video className="w-8 h-8 text-comic-ink" />}
          </button>

          {!isVideoOff && (
            <button
              onClick={flipCamera}
              className="flex items-center justify-center p-4 rounded-full border-4 border-comic-ink bg-comic-purple shadow-comic transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none"
              title="Flip Camera"
            >
              <RefreshCcw className="w-8 h-8 text-white" />
            </button>
          )}
          
          <button
            onClick={onClose}
            className="flex items-center justify-center px-8 py-4 rounded-2xl bg-comic-red border-4 border-comic-ink shadow-comic transition-all hover:-translate-y-1 hover:bg-red-500 active:translate-y-1 active:shadow-none"
            title="End Call"
          >
            <span className="text-white font-black font-heading text-xl tracking-wider">HANG UP</span>
          </button>
        </div>

      </div>
    </div>
  );
};
