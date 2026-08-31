'use client';
import { useEffect, useState } from 'react';
import { AuthScreen } from './auth/AuthScreen';
import { ChatLayout } from './chat/ChatLayout';
import { useChatStore } from '@/store/chatStore';

export function MainApp() {
  const [isInitializing, setIsInitializing] = useState(true);
  const currentUser = useChatStore(state => state.currentUser);
  const setCurrentUser = useChatStore(state => state.setCurrentUser);

  useEffect(() => {
    // Check session on mount
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(console.error)
      .finally(() => setIsInitializing(false));
  }, [setCurrentUser]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-comic-bg">
        <div className="animate-bounce flex flex-col items-center">
          <div className="text-6xl mb-4">🤡</div>
          <p className="mt-4 text-comic-ink font-heading font-black text-xl tracking-wider uppercase">Loading Circus...</p>
        </div>
      </div>
    );
  }

  return currentUser ? <ChatLayout /> : <AuthScreen />;
}
