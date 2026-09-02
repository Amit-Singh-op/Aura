'use client';
import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useChatStore } from '@/store/chatStore';
import { Button } from '@/components/ui/button';
import { Send, MessageSquareDashed, SmilePlus, Download, X, Sparkles, ChevronLeft, Smile, Check, CheckCheck, Clock, Video } from 'lucide-react';
import { Message, Sticker } from '@/lib/storage/types';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { MediaPicker } from './MediaPicker';
import { PowerShower } from './PowerShower';
import { BulletShower } from './BulletShower';
import { SwipeToReply } from './SwipeToReply';
import { VideoChatPanel } from './VideoChatPanel';

const BULLET_ACTIONS = [
  { id: 'chal bhag', emoji: '🏃‍♂️💨', label: 'chal bhag' },
  { id: 'slap', emoji: '✋💥', label: 'slap' },
  { id: 'love', emoji: '❤️✨', label: 'love' },
  { id: 'party', emoji: '🎉🎊', label: 'party' },
];

export function ChatArea({ socket }: { socket: Socket | null }) {
  const { activeRoomId, setActiveRoomId, rooms, currentUser, messages, setMessages, addMessage, notifications, markNotificationAsRead, replacePendingMessage, updateMessageStatus } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [roomUsers, setRoomUsers] = useState<{id: string, name: string}[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  const [isPowerMessage, setIsPowerMessage] = useState(false);
  const [powerAnimations, setPowerAnimations] = useState<{id: string, text: string, textColor: string, bgColor: string}[]>([]);
  const [bulletAnimations, setBulletAnimations] = useState<{id: string, emoji: string, text: string}[]>([]);
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [powerTextColor, setPowerTextColor] = useState('#ffffff');
  const [powerBgColor, setPowerBgColor] = useState('transparent');
  const [downloadingStickers, setDownloadingStickers] = useState<Record<string, boolean>>({});

  // Mention Autocomplete States
  const [allUsers, setAllUsers] = useState<{id: string, username: string}[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Video Chat States
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [videoStatus, setVideoStatus] = useState<{ active: boolean, users: string[] }>({ active: false, users: [] });

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAllUsers(data);
      })
      .catch(console.error);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  useEffect(() => {
    if (!activeRoomId || !currentUser) return;

    // Mark notifications in this room as read
    const unreadInRoom = notifications.filter(n => n.roomId === activeRoomId && !n.read);
    unreadInRoom.forEach(n => {
      markNotificationAsRead(n.id);
      fetch(`/api/notifications/${n.id}`, { method: 'PATCH' }).catch(console.error);
    });

    let loadInterval: NodeJS.Timeout;
    let isCancelled = false;
    
    setIsFetching(true);
    setMessages([]);

    // Fetch initial messages
    fetch(`/api/rooms/${activeRoomId}/messages`)
      .then(res => res.json())
      .then(data => {
        if (isCancelled) return;
        if (Array.isArray(data)) {
          let i = 0;
          loadInterval = setInterval(() => {
            if (i < data.length) {
              const nextMsg = data[i];
              addMessage(nextMsg);
              
              if (socket && nextMsg.userId !== currentUser.id) {
                if (!nextMsg.deliveredTo?.includes(currentUser.id)) {
                  socket.emit('mark_delivered', { roomId: activeRoomId, messageId: nextMsg.id, userId: currentUser.id });
                }
                if (document.visibilityState === 'visible' && !nextMsg.seenBy?.includes(currentUser.id)) {
                  socket.emit('mark_seen', { roomId: activeRoomId, messageId: nextMsg.id, userId: currentUser.id });
                }
              }
              
              i++;
            } else {
              clearInterval(loadInterval);
              setIsFetching(false);
            }
          }, 35);
        } else {
          setIsFetching(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!isCancelled) setIsFetching(false);
      });

    if (socket) {
      const join = () => {
        socket.emit('join_room', { roomId: activeRoomId, userId: currentUser.id, username: currentUser.username });
      };

      socket.on('connect', join);
      if (socket.connected) {
        join();
      }

      socket.on('new_message', (msg: Message) => {
        if (msg.roomId === activeRoomId) {
          if (msg.pendingId && msg.userId === currentUser.id) {
            replacePendingMessage(msg.pendingId, msg);
          } else {
            addMessage(msg);
            if (msg.userId !== currentUser.id) {
              socket.emit('mark_delivered', { roomId: activeRoomId, messageId: msg.id, userId: currentUser.id });
              if (document.visibilityState === 'visible') {
                socket.emit('mark_seen', { roomId: activeRoomId, messageId: msg.id, userId: currentUser.id });
              }
            }
          }
          if (msg.type === 'power' && msg.powerOptions) {
            setPowerAnimations(prev => [...prev, { id: msg.id, text: msg.content, textColor: msg.powerOptions!.textColor, bgColor: msg.powerOptions!.bgColor }]);
          } else if (msg.type === 'bullet' && msg.bulletOptions) {
            setBulletAnimations(prev => [...prev, { id: msg.id, emoji: msg.bulletOptions!.emoji, text: msg.bulletOptions!.text }]);
          }
        }
      });

      socket.on('video_status', (data: { roomId: string, active: boolean, users: string[] }) => {
        if (data.roomId === activeRoomId) {
          setVideoStatus({ active: data.active, users: data.users || [] });
        }
      });
      socket.emit('check_video_status', { roomId: activeRoomId });

      socket.on('message_status_update', (data: { messageId: string, roomId: string, deliveredTo?: string[], seenBy?: string[] }) => {
        if (data.roomId === activeRoomId) {
          updateMessageStatus(data.roomId, data.messageId, {
            deliveredTo: data.deliveredTo,
            seenBy: data.seenBy
          });
        }
      });

      socket.on('system_message', (msg: Message) => {
        if (msg.roomId === activeRoomId) {
          addMessage(msg);
        }
      });

      socket.on('presence_update', (data: { roomId: string; count: number; users?: {id: string, name: string}[] }) => {
        if (data.roomId === activeRoomId && data.users) {
          setRoomUsers(data.users);
        }
      });

      socket.on('user_typing', (data: { roomId: string; username: string; isTyping: boolean }) => {
        if (data.roomId === activeRoomId && data.username !== currentUser.username) {
          setTypingUsers(prev => {
            if (data.isTyping) {
              return prev.includes(data.username) ? prev : [...prev, data.username];
            }
            return prev.filter(u => u !== data.username);
          });
        }
      });

      socket.on('app_error', (data: { message: string }) => {
        alert(data.message);
        if (data.message.includes('User session invalid')) {
          fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
            useChatStore.getState().setCurrentUser(null);
            window.location.href = '/';
          });
        }
      });

      socket.on('message_reaction_updated', (data: { messageId: string; roomId: string; reactions: Record<string, string[]> }) => {
        useChatStore.getState().updateMessageReactions(data.roomId, data.messageId, data.reactions);
      });
    }

    return () => {
      isCancelled = true;
      if (loadInterval) clearInterval(loadInterval);
      if (socket) {
        socket.off('connect');
        socket.emit('leave_room', { roomId: activeRoomId, userId: currentUser.id, username: currentUser.username });
        socket.off('new_message');
        socket.off('system_message');
        socket.off('user_typing');
        socket.off('presence_update');
        socket.off('app_error');
        socket.off('message_reaction_updated');
        socket.off('message_status_update');
        socket.off('video_status');
      }
      setTypingUsers([]);
      setRoomUsers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, currentUser, socket, setMessages, addMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !socket || !currentUser || !activeRoomId) return;

    const isPowerMessage = inputValue.startsWith('>:');
    const powerText = isPowerMessage ? inputValue.slice(2).trim() : inputValue.trim();

    if (isPowerMessage && powerText.length > 12) {
      return; // Validation handled by UI, but double check
    }

    const bulletActionMatch = inputValue.trim().match(/^@(\w+)\s+(.+)$/);
    let bulletAction = null;
    let finalType: 'text' | 'power' | 'bullet' = isPowerMessage ? 'power' : 'text';
    let finalContent = powerText;

    if (bulletActionMatch && !isPowerMessage) {
      const username = bulletActionMatch[1];
      const actionText = bulletActionMatch[2];
      const foundAction = BULLET_ACTIONS.find(a => a.id.toLowerCase() === actionText.toLowerCase());
      const isLegitUser = allUsers.some(u => u.username.toLowerCase() === username.toLowerCase());
      if (foundAction && isLegitUser) {
        bulletAction = { targetUsername: username, emoji: foundAction.emoji, text: `@${username}` };
        finalType = 'bullet';
        finalContent = foundAction.emoji; // Emoji acts as content for history
      }
    }

    setIsSending(true);
    
    const pendingId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempMessage: Message = {
      id: pendingId,
      roomId: activeRoomId,
      userId: currentUser.id,
      username: currentUser.username,
      content: finalContent,
      type: finalType,
      timestamp: Date.now(),
      powerOptions: finalType === 'power' ? { textColor: powerTextColor, bgColor: powerBgColor } : undefined,
      bulletOptions: bulletAction || undefined,
      replyTo: replyingTo ? { id: replyingTo.id, username: replyingTo.username, content: replyingTo.content, type: replyingTo.type } : undefined
    };
    
    addMessage(tempMessage);

    socket.emit('send_message', {
      roomId: activeRoomId,
      userId: currentUser.id,
      username: currentUser.username,
      content: finalContent,
      type: finalType,
      powerOptions: finalType === 'power' ? {
        textColor: powerTextColor,
        bgColor: powerBgColor
      } : undefined,
      bulletOptions: bulletAction || undefined,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        content: replyingTo.content,
        type: replyingTo.type
      } : undefined,
      pendingId
    });
    socket.emit('user_typing', { roomId: activeRoomId, username: currentUser.username, isTyping: false });

    setInputValue('');
    setReplyingTo(null);
    setIsSending(false);
    setMentionQuery(null);
  };

  const handleMentionSelect = (username: string) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart;
    const textBeforeCursor = inputValue.slice(0, cursor);
    const textAfterCursor = inputValue.slice(cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);
    
    if (match) {
      const startIdx = match.index!;
      const newText = inputValue.slice(0, startIdx) + `@${username} ` + textAfterCursor;
      setInputValue(newText);
      setMentionQuery(null);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursor = startIdx + username.length + 2;
          inputRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 0);
    }
  };

  const filteredMentionUsers = mentionQuery !== null
    ? allUsers.filter(u => u.username.toLowerCase().startsWith(mentionQuery.toLowerCase()) && u.username !== currentUser?.username).slice(0, 5)
    : [];

  const handleSendSticker = (sticker: Sticker) => {
    if (!socket || !currentUser || !activeRoomId) return;
    const pendingId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempMessage: Message = {
      id: pendingId,
      roomId: activeRoomId,
      userId: currentUser.id,
      username: currentUser.username,
      content: sticker.url,
      type: 'sticker',
      stickerId: sticker.id,
      timestamp: Date.now(),
      replyTo: replyingTo ? { id: replyingTo.id, username: replyingTo.username, content: replyingTo.content, type: replyingTo.type } : undefined
    };
    addMessage(tempMessage);

    socket.emit('send_message', {
      roomId: activeRoomId,
      userId: currentUser.id,
      username: currentUser.username,
      content: sticker.url,
      type: 'sticker',
      stickerId: sticker.id,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        content: replyingTo.content,
        type: replyingTo.type
      } : undefined,
      pendingId
    });
    setShowMediaPicker(false);
    setReplyingTo(null);
  };

  const handleSaveSticker = async (stickerId: string) => {
    setDownloadingStickers(prev => ({ ...prev, [stickerId]: true }));
    try {
      await fetch('/api/users/me/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stickerId })
      });
      // Could show a toast here
    } catch (err) {
      console.error('Failed to save sticker:', err);
    } finally {
      setDownloadingStickers(prev => ({ ...prev, [stickerId]: false }));
    }
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!socket || !currentUser || !activeRoomId) return;
    socket.emit('toggle_reaction', {
      roomId: activeRoomId,
      messageId,
      emoji,
      userId: currentUser.id,
      username: currentUser.username
    });
    setShowReactionPickerFor(null);
  };

  if (!activeRoomId || !activeRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-comic-ink bg-comic-bg border-l-4 border-comic-ink">
        <MessageSquareDashed className="w-20 h-20 mb-4 opacity-50" />
        <h2 className="font-heading text-2xl font-black text-comic-ink">No room selected</h2>
        <p className="mt-2 text-lg font-bold opacity-80">Choose a room from the sidebar to start chatting. 🤡</p>
      </div>
    );
  }

  const renderMessageContent = (content: string, isOwnMessage: boolean) => {
    if (content.toLowerCase().includes('#all')) {
      const customMsg = content.replace(/#all/gi, '').trim();
      return (
        <div className="flex flex-col items-center justify-center p-2 sm:p-4 mt-1 w-full min-w-[200px] sm:min-w-[250px]">
          <span className="inline-block bg-comic-red text-white font-black text-[10px] sm:text-xs px-3 py-1 rounded-full border-2 border-comic-ink animate-pulse shadow-comic-sm transform -rotate-3 mb-3 uppercase tracking-widest whitespace-nowrap">
            🚨 Global Summon 🚨
          </span>
          {customMsg && (
            <span 
              className={`font-heading font-black text-xl sm:text-3xl text-center leading-tight tracking-wide ${isOwnMessage ? 'text-comic-ink' : 'text-comic-purple'}`}
              style={!isOwnMessage ? { textShadow: '2px 2px 0 #2B1B3D', WebkitTextStroke: '1px #2B1B3D', color: '#FF3D7F' } : {}}
            >
              &quot;{customMsg}&quot;
            </span>
          )}
        </div>
      );
    }

    const parts = content.split(/(@\w+)/gi);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className={`font-bold ${isOwnMessage ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Group messages
  const groupedMessages: { type: 'system' | 'user'; msg: Message; showHeader: boolean }[] = [];
  let lastUserId: string | null = null;
  let lastTime = 0;

  messages.forEach(msg => {
    if (msg.userId === 'system') {
      groupedMessages.push({ type: 'system', msg, showHeader: false });
      lastUserId = null;
    } else {
      const isNewGroup = lastUserId !== msg.userId || (msg.timestamp - lastTime) > 5 * 60 * 1000;
      groupedMessages.push({ type: 'user', msg, showHeader: isNewGroup });
      lastUserId = msg.userId;
      lastTime = msg.timestamp;
    }
  });

  if (!activeRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-comic-bg relative p-6 text-center border-l-4 border-comic-ink">
        <div className="w-24 h-24 bg-comic-pink border-4 border-comic-ink shadow-comic rounded-full flex items-center justify-center mb-6 -rotate-3">
          <MessageSquareDashed className="w-12 h-12 text-white" />
        </div>
        <h2 className="font-heading text-4xl font-black text-comic-ink mb-2">Room Unavailable</h2>
        <p className="text-lg font-bold text-comic-ink/80 max-w-sm">This room has been deleted or you no longer have access to it.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-comic-bg border-l-4 border-comic-ink relative overflow-hidden">
      
      {/* Power Animations Overlay */}
      {powerAnimations.map(anim => (
        <PowerShower
          key={anim.id}
          id={anim.id}
          text={anim.text}
          textColor={anim.textColor}
          bgColor={anim.bgColor}
          onComplete={(id) => setPowerAnimations(prev => prev.filter(p => p.id !== id))}
        />
      ))}

      {/* Bullet Animations Overlay */}
      {bulletAnimations.map(anim => (
        <BulletShower
          key={anim.id}
          id={anim.id}
          emoji={anim.emoji}
          text={anim.text}
          onComplete={(id) => setBulletAnimations(prev => prev.filter(p => p.id !== id))}
        />
      ))}

      {/* Header */}
      <div className="h-20 shrink-0 border-b-4 border-comic-ink flex items-center px-4 sm:px-6 justify-between bg-comic-teal z-10">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setActiveRoomId(null)}
            className="md:hidden p-2 -ml-2 rounded-full border-2 border-transparent hover:border-comic-ink hover:bg-comic-yellow/50 text-comic-ink transition-all hover:-translate-y-0.5 hover:shadow-comic-sm"
          >
            <ChevronLeft className="w-8 h-8 font-bold" />
          </button>
          <span className="text-2xl drop-shadow-sm">{activeRoom.icon || '💬'}</span>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100">{activeRoom.name}</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
            {roomUsers.length > 0 && (
              <div className="flex -space-x-1.5 overflow-hidden">
                {roomUsers.slice(0, 4).map(u => (
                  <div key={u.id} className="inline-block h-5 w-5 rounded-xl border-2 border-comic-ink bg-comic-purple text-[10px] text-white flex items-center justify-center font-heading font-black shadow-comic-sm" title={u.name}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {roomUsers.length > 4 && (
                  <div className="inline-block h-5 w-5 rounded-xl border-2 border-comic-ink bg-comic-yellow text-[10px] text-comic-ink flex items-center justify-center font-heading font-black shadow-comic-sm">
                    +{roomUsers.length - 4}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {roomUsers.length > 0 ? (
                <>{roomUsers.length} {roomUsers.length === 1 ? 'person' : 'people'} here</>
              ) : (
                activeRoom.description
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowVideoCall(true)}
          className={`px-4 py-2 rounded-xl border-2 border-comic-ink font-bold flex items-center gap-2 transition-all ${
            videoStatus.active 
              ? 'bg-comic-pink text-comic-ink animate-pulse shadow-comic-hover' 
              : 'bg-comic-yellow text-comic-ink hover:bg-yellow-400'
          }`}
        >
          <Video className="w-5 h-5" />
          <span className="hidden sm:inline">{videoStatus.active ? 'Join Video' : 'Start Video'}</span>
        </button>
      </div>

      {showVideoCall && activeRoomId && (
        <VideoChatPanel
          socket={socket!}
          roomId={activeRoomId}
          userId={currentUser?.id ?? ''}
          username={currentUser?.username ?? ''}
          onClose={() => setShowVideoCall(false)}
        />
      )}
    </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4" ref={containerRef} onClick={() => setShowMediaPicker(false)}>
        {messages.length === 0 && !isFetching ? (
          <div className="h-full flex flex-col items-center justify-center text-comic-ink font-heading">
            <p className="text-xl font-bold bg-comic-yellow/50 px-6 py-3 rounded-2xl border-4 border-comic-ink shadow-comic -rotate-2">No messages yet. Be the first to say hello! 🎪</p>
          </div>
        ) : (
          groupedMessages.map((item) => {
            if (item.type === 'system') {
              return (
                <div key={item.msg.id} className="flex justify-center my-6">
                  <span className="text-sm font-bold px-4 py-1.5 bg-comic-teal/30 border-2 border-comic-ink text-comic-ink rounded-full shadow-comic-sm">
                    {item.msg.content}
                  </span>
                </div>
              );
            }

            const isOwn = item.msg.userId === currentUser?.id;
            const hasReply = !!item.msg.replyTo;
            const isReplyToMe = !isOwn && hasReply && item.msg.replyTo?.username === currentUser?.username;
            
            return (
              <div key={item.msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} ${item.showHeader ? 'mt-6' : 'mt-1.5'} group`}>
                {item.showHeader && (
                  <div className={`flex items-baseline gap-2 mb-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'} px-1`}>
                    <span className="font-heading text-sm font-bold text-comic-ink">
                      {isOwn ? 'You' : item.msg.username}
                    </span>
                  </div>
                )}
                
                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85vw] sm:max-w-[75%]`}>
                  <div className={`flex items-center gap-2 relative ${isOwn ? 'flex-row-reverse' : 'flex-row'} w-fit max-w-full`}>
                      <SwipeToReply 
                        direction={isOwn ? 'left' : 'right'}
                        onSwipeChange={(isSwiping) => setSwipingMessageId(isSwiping ? item.msg.id : null)}
                        onReply={() => {
                      setReplyingTo(item.msg);
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }}>
                      <div 
                      id={`msg-bubble-${item.msg.id}`}
                      className={`
                        relative px-4 py-2.5 rounded-3xl break-words text-[16px] font-medium leading-relaxed border-2 border-comic-ink shadow-comic transition-all duration-300 group/bubble
                        ${isOwn 
                          ? 'bg-comic-yellow text-comic-ink rounded-tr-sm' 
                          : 'bg-white text-comic-ink rounded-tl-sm'}
                        ${isReplyToMe ? 'ring-4 ring-comic-pink shadow-comic-hover' : ''}
                        ${item.msg.type === 'sticker' ? '!p-0 !bg-transparent !bg-none !border-none !shadow-none !ring-0' : ''}
                        ${hasReply && item.msg.type !== 'sticker' ? 'pt-2' : ''}
                      `}
                    >
                      {/* Quoted Reply Block */}
                      {hasReply && (
                        <div 
                          onClick={() => {
                             // Scroll to replied message if it exists in DOM
                             const repliedEl = document.getElementById(`msg-bubble-${item.msg.replyTo!.id}`);
                             if (repliedEl) {
                               repliedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                               // Add focus highlight effect without adding a border
                               repliedEl.classList.add('scale-105', 'brightness-110', 'saturate-150', 'z-50', 'shadow-2xl');
                               setTimeout(() => {
                                 repliedEl.classList.remove('scale-105', 'brightness-110', 'saturate-150', 'z-50', 'shadow-2xl');
                               }, 1500);
                             }
                          }}
                          className={`
                            mb-2 p-2 rounded-xl text-sm border-l-4 cursor-pointer transition-all hover:-translate-y-0.5 border-4 border-comic-ink
                            ${isOwn 
                              ? 'bg-comic-orange/20 text-comic-ink' 
                              : 'bg-comic-teal/20 text-comic-ink'}
                            ${item.msg.type === 'sticker' ? 'bg-white shadow-comic-sm mb-1' : ''}
                          `}
                        >
                          <div className="font-heading font-black text-sm mb-0.5 uppercase tracking-wider">
                            {item.msg.replyTo!.username}
                          </div>
                          {item.msg.replyTo!.type === 'sticker' ? (
                            <div className="flex items-center gap-1 font-bold">
                              <Sparkles className="w-4 h-4" /> <span>Sticker</span>
                            </div>
                          ) : (
                            <div className="line-clamp-2 leading-tight whitespace-pre-wrap [word-break:break-word] font-bold">
                              {item.msg.replyTo!.content}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {item.msg.type === 'sticker' ? (
                        <div className="relative group/sticker inline-block p-1" id={`msg-${item.msg.id}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={item.msg.content} 
                            alt="Sticker" 
                            onClick={() => setFullScreenImage(item.msg.content)}
                            className={`max-w-[200px] max-h-[200px] object-contain hover:scale-105 transition-transform duration-200 cursor-pointer ${
                              isOwn 
                                ? 'rounded-2xl border-4 border-comic-ink shadow-comic bg-comic-yellow p-1.5' 
                                : 'rounded-2xl border-4 border-comic-ink shadow-comic bg-white p-1.5'
                            }`} 
                          />
                        </div>
                      ) : item.msg.type === 'power' ? (
                        <div 
                          className={`relative p-3 sm:p-5 rounded-2xl cursor-pointer hover:scale-105 hover:-translate-y-1 transition-all duration-300 shadow-comic border-4 border-comic-ink overflow-hidden group/power flex flex-col items-center justify-center text-center ${item.msg.powerOptions?.bgColor === 'transparent' ? (isOwn ? 'bg-comic-yellow' : 'bg-white') : ''}`}
                          style={{
                            backgroundColor: item.msg.powerOptions?.bgColor === 'transparent' ? undefined : item.msg.powerOptions?.bgColor,
                            color: item.msg.powerOptions?.textColor || '#fff',
                          }}
                          onClick={() => {
                            setPowerAnimations(prev => [...prev, {
                              id: `${item.msg.id}-${Date.now()}`,
                              text: item.msg.content,
                              textColor: item.msg.powerOptions?.textColor || '#fff',
                              bgColor: item.msg.powerOptions?.bgColor || 'transparent'
                            }]);
                          }}
                          title="Click to replay animation!"
                        >
                          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/power:opacity-100 transition-opacity"></div>
                          
                          {/* Always-visible Badge */}
                          <div className="flex items-center gap-1.5 mb-2 bg-black/50 text-white px-2.5 py-0.5 rounded-full border border-white/20 shadow-sm backdrop-blur-sm self-start">
                            <Sparkles className="w-3 h-3 animate-pulse text-comic-yellow" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Power</span>
                          </div>
                          
                          <div 
                            className="font-black text-3xl sm:text-5xl tracking-tighter"
                            style={{
                              WebkitTextStroke: '1px #2B1B3D',
                              textShadow: '3px 3px 0px #2B1B3D'
                            }}
                          >
                            {item.msg.content}
                          </div>
                        </div>
                      ) : item.msg.type === 'bullet' && item.msg.bulletOptions ? (
                        <div className="relative flex flex-col items-center justify-center p-2 sm:p-4 rounded-2xl bg-white/40 border-4 border-dashed border-comic-ink/30 min-w-[200px]" id={`msg-${item.msg.id}`}>
                           <div className="text-5xl sm:text-7xl animate-bounce drop-shadow-2xl mb-2 filter saturate-150 transform hover:scale-125 transition-transform cursor-pointer">
                             {item.msg.bulletOptions.emoji}
                           </div>
                           <div className="font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-comic-ink bg-white px-3 py-1 rounded-xl border-2 border-comic-ink shadow-comic-sm text-center">
                             <span className="text-comic-purple">{isOwn ? 'You' : item.msg.username}</span> 
                             <span className="mx-1.5 opacity-80">
                               {BULLET_ACTIONS.find(a => a.emoji === item.msg.bulletOptions?.emoji)?.id || 'hit'}
                             </span> 
                             <span className="text-comic-pink">@{item.msg.bulletOptions.targetUsername}</span>
                           </div>
                        </div>
                      ) : (
                        <div className="relative whitespace-pre-wrap [word-break:break-word]" id={`msg-${item.msg.id}`}>
                          {renderMessageContent(item.msg.content, isOwn)}
                        </div>
                      )}
                      </div>
                    </SwipeToReply>
                  {/* Action Buttons */}
                  <div className={`hidden md:flex gap-1.5 pointer-events-none transition-all self-center shrink-0 absolute top-1/2 -translate-y-1/2 z-50 ${swipingMessageId === item.msg.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto'}`} style={{ [isOwn ? 'right' : 'left']: 'calc(100% + 10px)' }}>
                    {!isOwn && item.msg.type === 'sticker' && item.msg.stickerId && (
                      <button 
                        onClick={() => handleSaveSticker(item.msg.stickerId!)}
                        className="p-2 rounded-xl bg-comic-yellow border-2 border-comic-ink text-comic-ink shadow-comic-sm hover:-translate-y-1 hover:shadow-comic transition-all z-50 disabled:opacity-70 disabled:hover:-translate-y-0 disabled:hover:shadow-comic-sm"
                        title="Save Sticker"
                        disabled={downloadingStickers[item.msg.stickerId!]}
                      >
                        {downloadingStickers[item.msg.stickerId!] ? <div className="w-5 h-5 animate-spin flex items-center justify-center">🤡</div> : <Download className="w-5 h-5 font-bold" />}
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setReplyingTo(item.msg);
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }}
                      className="p-2 rounded-xl bg-comic-pink border-2 border-comic-ink text-white shadow-comic-sm hover:-translate-y-1 hover:shadow-comic transition-all z-50"
                      title="Reply"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    </button>
                    <div>
                      <button 
                        onClick={() => setShowReactionPickerFor(showReactionPickerFor === item.msg.id ? null : item.msg.id)}
                        className="p-2 rounded-xl bg-comic-purple border-2 border-comic-ink text-white shadow-comic-sm hover:-translate-y-1 hover:shadow-comic transition-all z-50"
                        title="React"
                      >
                        <Smile className="w-5 h-5 font-bold" />
                      </button>
                      {showReactionPickerFor === item.msg.id && (
                        <>
                          <div className="fixed inset-0 z-[90]" onClick={(e) => { e.stopPropagation(); setShowReactionPickerFor(null); }}></div>
                          
                          <div className={`
                            absolute top-[calc(100%+8px)] 
                            ${isOwn ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}
                            z-[100] bg-comic-bg border-4 border-comic-ink rounded-3xl sm:rounded-full shadow-comic-hover flex flex-wrap justify-center p-2 sm:p-3 gap-1.5 sm:gap-2 animate-in zoom-in-75 duration-200 w-[260px] sm:w-max max-w-[90vw]
                          `}>
                            {['❤️', '😂', '🤡', '🎉', '👍', '👎', '🔥'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleReaction(item.msg.id, emoji);
                                }}
                                className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-comic-yellow hover:shadow-comic-sm border-2 border-transparent hover:border-comic-ink rounded-full transition-all hover:scale-125 focus:outline-none"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  </div>
                  
                  {/* Reaction Badges */}
                  {item.msg.reactions && Object.keys(item.msg.reactions).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'} w-full relative z-10`}>
                      {Object.entries(item.msg.reactions).map(([emoji, users]) => (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(item.msg.id, emoji)}
                          className={`
                            flex items-center gap-1 px-2 py-0.5 rounded-xl text-sm font-bold border-2 transition-transform hover:-translate-y-0.5 active:translate-y-0 shadow-comic-sm
                            ${users.includes(currentUser?.username || '') 
                              ? 'bg-comic-pink border-comic-ink text-white' 
                              : 'bg-white border-comic-ink text-comic-ink'}
                          `}
                          title={users.join(', ')}
                        >
                          <span className="text-base">{emoji}</span>
                          <span className="font-heading">{users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Timestamp & Status Below Bubble */}
                  <div className={`flex items-center gap-1 mt-1 mx-2 text-[11px] font-bold font-heading text-comic-ink/60 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <span>{new Date(item.msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isOwn && (
                      <span className="flex items-center ml-1">
                        {item.msg.id.startsWith('temp-') ? (
                          <Clock className="w-3.5 h-3.5 text-comic-ink/40" />
                        ) : item.msg.seenBy && item.msg.seenBy.length > 0 ? (
                          <CheckCheck className="w-4 h-4 text-comic-pink" />
                        ) : item.msg.deliveredTo && item.msg.deliveredTo.length > 0 ? (
                          <CheckCheck className="w-4 h-4 text-comic-ink/50" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-comic-ink/50" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 mt-4 px-2 mb-2 animate-bounce transition-all">
            <div className="flex gap-2 bg-white px-4 py-2 rounded-2xl shadow-comic-sm border-2 border-comic-ink items-center">
              <div className="flex gap-1 items-center h-4">
                <div className="w-2 h-2 bg-comic-purple rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-comic-pink rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-comic-yellow rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm font-bold font-heading text-comic-ink ml-2">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input */}
      <div className="p-4 sm:p-6 bg-transparent relative z-20">
        
        {/* Power Message Controls */}
        {inputValue.startsWith('>:') && (
          <div className="max-w-4xl mx-auto mb-3 bg-comic-teal/30 border-4 border-comic-ink rounded-2xl p-3 flex flex-col sm:flex-row justify-between items-center shadow-comic-sm gap-3">
            <div className="flex-1 overflow-hidden w-full">
              <div className="flex items-center gap-2 font-heading font-black text-comic-ink text-lg mb-0.5 uppercase tracking-wider">
                <Sparkles className="w-5 h-5 animate-pulse text-comic-purple" />
                Power Mode On!
              </div>
              <div className={`text-sm font-bold ${inputValue.slice(2).trim().length > 12 ? 'text-comic-pink bg-comic-pink/20 px-2 py-0.5 rounded-lg border-2 border-comic-ink inline-block mt-1' : 'text-comic-ink/80'}`}>
                {inputValue.slice(2).trim().length > 12 ? "Max 12 chars! Keep it punchy!" : "This text will be HUGE!"}
              </div>
            </div>
            
            <div className="flex gap-4 items-center bg-white p-2 rounded-xl border-4 border-comic-ink w-full sm:w-auto shrink-0 justify-center shadow-comic-sm">
              <div className="flex flex-col items-center gap-1">
                <label className="text-xs font-bold font-heading text-comic-ink uppercase tracking-wider">Text</label>
                <input type="color" value={powerTextColor} onChange={e => setPowerTextColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-2 border-comic-ink p-0" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <label className="text-xs font-bold font-heading text-comic-ink uppercase tracking-wider">BG</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={powerBgColor === 'transparent' ? '#ffffff' : powerBgColor} onChange={e => setPowerBgColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-2 border-comic-ink p-0 disabled:opacity-50" disabled={powerBgColor === 'transparent'} />
                  <label className="text-xs flex items-center gap-1 cursor-pointer font-bold text-comic-ink">
                    <input type="checkbox" checked={powerBgColor === 'transparent'} onChange={e => setPowerBgColor(e.target.checked ? 'transparent' : '#FFCC33')} className="rounded border-2 border-comic-ink text-comic-pink focus:ring-comic-pink w-4 h-4 cursor-pointer" />
                    None
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reply Preview Bar */}
        {replyingTo && (
          <div className="max-w-4xl mx-auto mb-3 bg-white border-4 border-comic-ink rounded-2xl p-3 flex justify-between items-start shadow-comic-sm">
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-heading font-black text-comic-purple mb-0.5 uppercase tracking-wider">
                Replying to {replyingTo.username}
              </div>
              <div className="text-md font-bold text-comic-ink truncate border-l-4 border-comic-yellow pl-2 mt-1">
                {replyingTo.type === 'sticker' ? 'Sticker 🎪' : replyingTo.content}
              </div>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="p-1.5 rounded-xl border-2 border-transparent hover:border-comic-ink hover:bg-comic-pink text-comic-ink hover:text-white transition-all shrink-0"
            >
              <X className="w-5 h-5 font-bold" />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 items-end max-w-4xl mx-auto relative bg-white p-2 rounded-full border-4 border-comic-ink shadow-comic transition-all focus-within:-translate-y-1 focus-within:shadow-comic-hover">
          
          {/* Action Suggestions Popup */}
          {inputValue.match(/^@(\w+)\s*$/) && (
            <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 bg-white border-4 border-comic-ink rounded-2xl shadow-comic z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-wrap justify-center p-2 gap-1.5 sm:gap-2 max-w-[95vw] w-max">
              {BULLET_ACTIONS.map(action => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    const match = inputValue.match(/^@(\w+)\s*$/);
                    if (match) {
                      setInputValue(`@${match[1]} ${action.id}`);
                      inputRef.current?.focus();
                    }
                  }}
                  className="px-2 sm:px-3 py-1.5 rounded-xl border-2 border-transparent hover:border-comic-ink hover:bg-comic-yellow/30 hover:-translate-y-0.5 hover:shadow-comic-sm transition-all flex items-center gap-1 sm:gap-1.5"
                >
                  <span className="font-heading text-[11px] sm:text-sm font-bold text-comic-ink whitespace-nowrap uppercase tracking-wider">{action.id}</span>
                  <span className="hidden sm:inline text-lg">{action.emoji}</span>
                </button>
              ))}
            </div>
          )}

          {/* #all Global Summon Hint Popup */}
          {inputValue.toLowerCase().includes('#all') && (
            <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 bg-white border-4 border-comic-ink rounded-[20px] shadow-comic z-50 animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center justify-center overflow-hidden max-w-[95vw] w-max transform -rotate-1">
              <div className="w-full bg-comic-yellow border-b-4 border-comic-ink p-2 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)' }}></div>
                <div className="text-4xl relative z-10 animate-bounce drop-shadow-lg mb-1">🚨</div>
                <div 
                  className="font-heading font-black text-white text-xl sm:text-2xl uppercase tracking-widest relative z-10" 
                  style={{ textShadow: '3px 3px 0 #2B1B3D', WebkitTextStroke: '1px #2B1B3D' }}
                >
                  GLOBAL SUMMON
                </div>
              </div>
              <div className="px-4 py-3 bg-comic-bg text-center w-full">
                <div className="text-xs sm:text-sm font-bold text-comic-ink leading-relaxed">
                  This will alert <span className="bg-comic-pink text-white px-1.5 py-0.5 rounded-lg border-2 border-comic-ink inline-block transform -rotate-3 uppercase mx-0.5">EVERYONE</span><br/> online to join! 🤡<br/>
                  <span className="text-comic-orange font-black mt-2 inline-block">Type a message after #all to announce it in a funny voice!</span>
                </div>
              </div>
            </div>
          )}

          {/* Mention Autocomplete Popup */}
          {mentionQuery !== null && filteredMentionUsers.length > 0 && (
            <>
              {/* Backdrop to close mention popup when clicking outside */}
              <div className="fixed inset-0 z-40" onClick={() => setMentionQuery(null)}></div>
              <div className="absolute bottom-[calc(100%+12px)] left-12 bg-white border-4 border-comic-ink rounded-2xl shadow-comic z-50 w-64 overflow-hidden">
              <div className="px-3 py-2 border-b-4 border-comic-ink bg-comic-teal/30 text-sm font-heading font-black text-comic-ink uppercase tracking-wider">
                Mention someone 🎯
              </div>
              <div className="py-1">
                {filteredMentionUsers.map((u, idx) => (
                  <div
                    key={u.id}
                    onMouseDown={(e) => { e.preventDefault(); handleMentionSelect(u.username); }}
                    className={`px-4 py-2 cursor-pointer flex items-center gap-3 transition-all border-l-4 ${idx === mentionIndex ? 'bg-comic-yellow/30 border-comic-orange' : 'border-transparent hover:bg-comic-yellow/10'}`}
                    onMouseEnter={() => setMentionIndex(idx)}
                  >
                    <div className="w-8 h-8 rounded-xl bg-comic-purple border-2 border-comic-ink flex items-center justify-center text-white font-heading font-black shrink-0 shadow-comic-sm">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-base font-bold text-comic-ink">
                      {u.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </>
          )}
          
          {showMediaPicker && (
            <MediaPicker 
              onEmojiSelect={(emoji) => {
                setInputValue(prev => prev + emoji);
                setShowMediaPicker(false);
              }}
              onStickerSelect={handleSendSticker}
              onClose={() => setShowMediaPicker(false)}
            />
          )}

          <button
            type="button"
            onClick={() => setShowMediaPicker(!showMediaPicker)}
            className="h-[44px] w-[44px] flex items-center justify-center rounded-full border-2 border-transparent hover:border-comic-ink hover:bg-comic-yellow/30 text-comic-ink transition-all shrink-0 mb-0.5 hover:-translate-y-0.5 hover:shadow-comic-sm"
            title="Emojis & Stickers"
          >
            <SmilePlus className="w-6 h-6" />
          </button>

          <textarea
            ref={inputRef}
            value={inputValue}
            onFocus={() => setShowMediaPicker(false)}
            onChange={(e) => {
              const val = e.target.value;
              setInputValue(val);
              
              // Mention parsing
              const cursor = e.target.selectionStart;
              const textBeforeCursor = val.slice(0, cursor);
              const match = textBeforeCursor.match(/@(\w*)$/);
              if (match) {
                setMentionQuery(match[1]);
                setMentionIndex(0);
              } else {
                setMentionQuery(null);
              }

              if (socket && currentUser && activeRoomId) {
                socket.emit('user_typing', { roomId: activeRoomId, username: currentUser.username, isTyping: val.length > 0 });
              }
            }}
            onKeyDown={(e) => {
              if (mentionQuery !== null && filteredMentionUsers.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionIndex(prev => (prev + 1) % filteredMentionUsers.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMentionIndex(prev => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  handleMentionSelect(filteredMentionUsers[mentionIndex].username);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setMentionQuery(null);
                  return;
                }
              }

              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Type something funny..."
            className="flex-1 max-h-32 min-h-[44px] resize-none bg-transparent px-2 py-3 text-[16px] text-comic-ink font-semibold focus:outline-none placeholder:text-comic-ink/50 scrollbar-hide border-none ring-0 focus:ring-0"
            rows={1}
            disabled={isSending}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!inputValue.trim() || isSending}
            className="h-[44px] w-[44px] rounded-full bg-comic-orange border-2 border-comic-ink hover:-translate-y-1 hover:shadow-comic transition-all duration-200 text-comic-ink shrink-0 shadow-comic-sm disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </Button>
        </form>
        <div className="text-center mt-3 text-xs text-comic-ink/60 font-bold">
          <kbd className="font-heading px-1.5 py-0.5 bg-comic-ink/10 rounded-md border border-comic-ink/20">Enter</kbd> to send, <kbd className="font-heading px-1.5 py-0.5 bg-comic-ink/10 rounded-md border border-comic-ink/20">Shift + Enter</kbd> for new line
        </div>
      </div>

      {/* Full-Screen Image Modal */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setFullScreenImage(null)}
        >
          <div className="relative animate-in zoom-in-95 duration-300 max-w-[95vw] sm:max-w-[85vw] max-h-[90vh] flex flex-col items-center">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setFullScreenImage(null);
              }}
              className="absolute -top-3 -right-3 sm:-top-5 sm:-right-5 w-10 h-10 sm:w-14 sm:h-14 bg-comic-red text-white border-2 sm:border-4 border-comic-ink rounded-full flex items-center justify-center hover:scale-110 hover:-rotate-12 transition-transform shadow-comic-sm z-50 font-black text-lg sm:text-2xl font-heading"
            >
              X
            </button>
            <div 
              className="max-w-full max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl border-4 sm:border-8 border-comic-ink shadow-[8px_8px_0px_0px_#FFCC33] sm:shadow-[16px_16px_0px_0px_#FFCC33] bg-white [&::-webkit-scrollbar]:w-3 sm:[&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-comic-pink [&::-webkit-scrollbar-thumb]:border-2 sm:[&::-webkit-scrollbar-thumb]:border-4 [&::-webkit-scrollbar-thumb]:border-comic-ink [&::-webkit-scrollbar-thumb]:rounded-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={fullScreenImage} 
                alt="Full Screen Preview" 
                className="max-w-full h-auto block" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
