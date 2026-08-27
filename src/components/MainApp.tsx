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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return currentUser ? <ChatLayout /> : <AuthScreen />;
}
