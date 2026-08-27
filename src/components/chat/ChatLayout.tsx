'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { useChatStore } from '@/store/chatStore';
import { io, Socket } from 'socket.io-client';

export function ChatLayout() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const currentUser = useChatStore(state => state.currentUser);
  const activeRoomId = useChatStore(state => state.activeRoomId);

  useEffect(() => {
    if (!currentUser) return;

    // Connect to the same host/port the Next app runs on
    const newSocket = io({
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser]);

  return (
    <div className="flex h-[100dvh] bg-slate-100 dark:bg-slate-950 p-0 sm:p-6 overflow-hidden relative z-0">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none hidden sm:block">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-500/10 dark:bg-purple-600/10 blur-[120px] rounded-full"></div>
      </div>
      
      {/* Workspace Container */}
      <div className="flex flex-1 w-full max-w-[1600px] mx-auto bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl sm:rounded-[2.5rem] sm:shadow-2xl sm:border border-white/60 dark:border-slate-700/50 overflow-hidden">
        <div className={`w-full md:w-80 shrink-0 ${activeRoomId ? 'hidden md:flex' : 'flex'}`}>
          <Sidebar socket={socket} />
        </div>
        <div className={`flex-1 flex flex-col min-w-0 ${!activeRoomId ? 'hidden md:flex' : 'flex'}`}>
          <ChatArea socket={socket} />
        </div>
      </div>
    </div>
  );
}
