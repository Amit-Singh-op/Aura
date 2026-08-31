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

    const verifySession = () => {
      fetch('/api/auth/session')
        .then(r => r.json())
        .then(data => {
          if (!data.user) {
            useChatStore.getState().setCurrentUser(null);
            window.location.href = '/';
          }
        })
        .catch(console.error);
    };

    newSocket.on('connect', verifySession);
    if (newSocket.connected) {
      verifySession();
    }

    setSocket(newSocket);

    return () => {
      newSocket.off('connect', verifySession);
      newSocket.disconnect();
    };
  }, [currentUser]);

  return (
    <div className="flex h-[100dvh] bg-comic-bg overflow-hidden relative z-0">
      {/* Workspace Container */}
      <div className="flex flex-1 w-full mx-auto bg-comic-bg overflow-hidden">
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
