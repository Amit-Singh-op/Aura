'use client';
import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useChatStore } from '@/store/chatStore';
import { Button } from '@/components/ui/button';
import { Send, MessageSquareDashed, SmilePlus, Download, X, Sparkles, ChevronLeft } from 'lucide-react';
import { Message, Sticker } from '@/lib/storage/types';
import { MediaPicker } from './MediaPicker';
import { PowerShower } from './PowerShower';

export function ChatArea({ socket }: { socket: Socket | null }) {
  const { activeRoomId, setActiveRoomId, rooms, currentUser, messages, setMessages, addMessage } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [roomUsers, setRoomUsers] = useState<{id: string, name: string}[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  // Power Message States
  const [powerAnimations, setPowerAnimations] = useState<{id: string, text: string, textColor: string, bgColor: string}[]>([]);
  const [powerTextColor, setPowerTextColor] = useState('#ffffff');
  const [powerBgColor, setPowerBgColor] = useState('transparent');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  useEffect(() => {
    if (!activeRoomId || !currentUser) return;

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
              i++;
            } else {
              clearInterval(loadInterval);
              setIsFetching(false);
            }
          }, 35); // 35ms stagger for that satisfying cascade effect
        } else {
          setIsFetching(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!isCancelled) setIsFetching(false);
      });

    if (socket) {
      socket.emit('join_room', { roomId: activeRoomId, userId: currentUser.id, username: currentUser.username });

      socket.on('new_message', (msg: Message) => {
        if (msg.roomId === activeRoomId) {
          addMessage(msg);
          if (msg.type === 'power' && msg.powerOptions) {
            setPowerAnimations(prev => [...prev, { id: msg.id, text: msg.content, textColor: msg.powerOptions!.textColor, bgColor: msg.powerOptions!.bgColor }]);
          }
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
    }

    return () => {
      isCancelled = true;
      if (loadInterval) clearInterval(loadInterval);
      if (socket) {
        socket.emit('leave_room', { roomId: activeRoomId, userId: currentUser.id, username: currentUser.username });
        socket.off('new_message');
        socket.off('system_message');
        socket.off('user_typing');
        socket.off('presence_update');
      }
      setTypingUsers([]);
      setRoomUsers([]);
    };
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

    if (isPowerMessage && powerText.length > 6) {
      return; // Validation handled by UI, but double check
    }

    setIsSending(true);
    socket.emit('send_message', {
      roomId: activeRoomId,
      userId: currentUser.id,
      username: currentUser.username,
      content: powerText,
      type: isPowerMessage ? 'power' : 'text',
      powerOptions: isPowerMessage ? {
        textColor: powerTextColor,
        bgColor: powerBgColor
      } : undefined,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        content: replyingTo.content,
        type: replyingTo.type
      } : undefined
    });
    socket.emit('user_typing', { roomId: activeRoomId, username: currentUser.username, isTyping: false });

    setInputValue('');
    setReplyingTo(null);
    setIsSending(false);
  };

  const handleSendSticker = (sticker: Sticker) => {
    if (!socket || !currentUser || !activeRoomId) return;
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
      } : undefined
    });
    setShowMediaPicker(false);
    setReplyingTo(null);
  };

  const handleSaveSticker = async (stickerId: string) => {
    try {
      await fetch('/api/users/me/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stickerId }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (!activeRoomId || !activeRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-950">
        <MessageSquareDashed className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-xl font-semibold text-slate-600 dark:text-slate-300">No room selected</h2>
        <p className="mt-2 text-sm">Choose a room from the sidebar to start chatting.</p>
      </div>
    );
  }

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

  return (
    <div className="flex-1 flex flex-col h-full bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl relative">
      
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

      {/* Header */}
      <div className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 sm:px-6 justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setActiveRoomId(null)}
            className="md:hidden p-1.5 -ml-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="text-2xl drop-shadow-sm">{activeRoom.icon || '💬'}</span>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100">{activeRoom.name}</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
            {roomUsers.length > 0 && (
              <div className="flex -space-x-1.5 overflow-hidden">
                {roomUsers.slice(0, 4).map(u => (
                  <div key={u.id} className="inline-block h-[18px] w-[18px] rounded-full ring-2 ring-white dark:ring-slate-900 bg-gradient-to-br from-indigo-500 to-purple-600 text-[9px] text-white flex items-center justify-center font-bold" title={u.name}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {roomUsers.length > 4 && (
                  <div className="inline-block h-[18px] w-[18px] rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-800 text-[8px] text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
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
      </div>
    </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4" ref={containerRef} onClick={() => setShowMediaPicker(false)}>
        {messages.length === 0 && !isFetching ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <p>No messages yet. Be the first to say hello!</p>
          </div>
        ) : (
          groupedMessages.map((item) => {
            if (item.type === 'system') {
              return (
                <div key={item.msg.id} className="flex justify-center my-6">
                  <span className="text-xs font-semibold px-4 py-1.5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shadow-sm border border-white/40 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 rounded-full">
                    {item.msg.content}
                  </span>
                </div>
              );
            }

            const isOwn = item.msg.userId === currentUser?.id;
            const hasReply = !!item.msg.replyTo;
            return (
              <div key={item.msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} ${item.showHeader ? 'mt-6' : 'mt-1.5'} group`}>
                {item.showHeader && (
                  <div className={`flex items-baseline gap-2 mb-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'} px-1`}>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {isOwn ? 'You' : item.msg.username}
                    </span>
                  </div>
                )}
                
                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85vw] sm:max-w-[75%]`}>
                  <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div 

                    id={`msg-bubble-${item.msg.id}`}
                    className={`
                      relative px-4 py-2.5 rounded-3xl break-words text-[15px] leading-relaxed shadow-sm transition-all duration-300 group/bubble
                      ${isOwn 
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-sm shadow-indigo-500/20' 
                        : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-slate-100 rounded-tl-sm border border-white/60 dark:border-slate-700/50'}
                      ${item.msg.type === 'sticker' ? '!p-0 !bg-transparent !bg-none !border-none !shadow-none' : ''}
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
                          mb-2 p-2 rounded-xl text-sm border-l-4 cursor-pointer transition-all hover:opacity-80
                          ${isOwn 
                            ? 'bg-white/20 border-white/50 text-white/90' 
                            : 'bg-slate-100/50 dark:bg-slate-700/50 border-indigo-400 dark:border-indigo-500 text-slate-600 dark:text-slate-300'}
                          ${item.msg.type === 'sticker' ? 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm mb-1' : ''}
                        `}
                      >
                        <div className={`font-bold text-xs mb-0.5 ${isOwn ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`}>
                          {item.msg.replyTo!.username}
                        </div>
                        {item.msg.replyTo!.type === 'sticker' ? (
                          <div className="flex items-center gap-1 opacity-80">
                            <Sparkles className="w-3 h-3" /> <span className="italic">Sticker</span>
                          </div>
                        ) : (
                          <div className="line-clamp-2 leading-tight whitespace-pre-wrap [word-break:break-word]">
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
                          className={`max-w-[200px] max-h-[200px] object-contain hover:scale-105 transition-transform duration-200 cursor-pointer ${
                            isOwn 
                              ? 'rounded-2xl border-2 border-indigo-400/60 dark:border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.3)] bg-white/20 dark:bg-slate-900/40 backdrop-blur-md p-1.5' 
                              : 'rounded-2xl border-2 border-white/80 dark:border-slate-700/60 shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-1.5'
                          }`} 
                        />
                      </div>
                    ) : item.msg.type === 'power' ? (
                      <div 
                        className={`relative p-3 sm:p-5 rounded-2xl cursor-pointer hover:scale-105 hover:-translate-y-1 transition-all duration-300 shadow-xl overflow-hidden group/power ${item.msg.powerOptions?.bgColor === 'transparent' ? (isOwn ? 'bg-gradient-to-r from-indigo-500/40 to-purple-500/40' : 'bg-white/40 dark:bg-slate-800/40') : ''}`}
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
                        <div className="flex items-center gap-1.5 mb-1 opacity-80 mix-blend-overlay">
                          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Power Message</span>
                        </div>
                        <div className="font-black text-3xl sm:text-5xl tracking-tighter drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]">
                          {item.msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="relative whitespace-pre-wrap [word-break:break-word]" id={`msg-${item.msg.id}`}>
                        {item.msg.content}
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all self-center shrink-0">
                    {!isOwn && item.msg.type === 'sticker' && item.msg.stickerId && (
                      <button 
                        onClick={() => handleSaveSticker(item.msg.stickerId!)}
                        className="p-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-md border border-slate-200/50 dark:border-slate-700/50 text-slate-500 hover:text-indigo-600 transition-transform hover:scale-110 z-50"
                        title="Save Sticker"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setReplyingTo(item.msg);
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }}
                      className="p-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-md border border-slate-200/50 dark:border-slate-700/50 text-slate-500 hover:text-indigo-600 transition-transform hover:scale-110 z-50"
                      title="Reply"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    </button>
                  </div>

                </div>
                  {/* Timestamp Below Bubble */}
                  <span className="text-[10px] font-medium mt-1 mx-2 text-slate-400 dark:text-slate-500">
                    {new Date(item.msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 mt-4 px-2 mb-2 animate-pulse transition-all">
            <div className="flex gap-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-white/40 dark:border-slate-700/50 items-center">
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-2">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
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
          <div className="max-w-4xl mx-auto mb-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-3 flex flex-col sm:flex-row justify-between items-center shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200 gap-3">
            <div className="flex-1 overflow-hidden w-full">
              <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Power Message Mode
              </div>
              <div className={`text-xs font-semibold ${inputValue.slice(2).trim().length > 6 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                {inputValue.slice(2).trim().length > 6 ? "Max 6 length exceeded! Please shorten your message." : "This is a powerful message with animation."}
              </div>
            </div>
            
            <div className="flex gap-4 items-center bg-white/50 dark:bg-slate-900/50 p-2 rounded-xl border border-white/40 dark:border-slate-700/50 w-full sm:w-auto shrink-0 justify-center">
              <div className="flex flex-col items-center gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Text</label>
                <input type="color" value={powerTextColor} onChange={e => setPowerTextColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Background</label>
                <div className="flex gap-1 items-center">
                  <input type="color" value={powerBgColor === 'transparent' ? '#000000' : powerBgColor} onChange={e => setPowerBgColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent opacity-80" disabled={powerBgColor === 'transparent'} />
                  <label className="text-[10px] flex items-center gap-1 cursor-pointer font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                    <input type="checkbox" checked={powerBgColor === 'transparent'} onChange={e => setPowerBgColor(e.target.checked ? 'transparent' : '#f43f5e')} className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500" />
                    None
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reply Preview Bar */}
        {replyingTo && (
          <div className="max-w-4xl mx-auto mb-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-l-4 border-l-indigo-500 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-3 flex justify-between items-start shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">
                Replying to {replyingTo.username}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300 truncate">
                {replyingTo.type === 'sticker' ? 'Sticker' : replyingTo.content}
              </div>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-400 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 items-end max-w-4xl mx-auto relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-2 rounded-[2rem] shadow-lg shadow-indigo-500/5 border border-white/60 dark:border-slate-700/50 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white/80 dark:focus-within:bg-slate-900/80">
          
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
            className="h-[44px] w-[44px] flex items-center justify-center rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 transition-colors shrink-0 mb-0.5"
            title="Emojis & Stickers"
          >
            <SmilePlus className="w-6 h-6" />
          </button>

          <textarea
            ref={inputRef}
            value={inputValue}
            onFocus={() => setShowMediaPicker(false)}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (socket && currentUser && activeRoomId) {
                socket.emit('user_typing', { roomId: activeRoomId, username: currentUser.username, isTyping: e.target.value.length > 0 });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder={`Message ${activeRoom.name}...`}
            className="flex-1 max-h-32 min-h-[44px] resize-none bg-transparent px-4 py-3 text-[15px] text-slate-900 dark:text-slate-50 focus:outline-none placeholder:text-slate-500 font-medium scrollbar-hide border-none ring-0 focus:ring-0"
            rows={1}
            disabled={isSending}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!inputValue.trim() || isSending}
            className="h-[44px] w-[44px] rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 hover:scale-105 transition-all duration-200 text-white shrink-0 shadow-md shadow-indigo-500/30 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </Button>
        </form>
        <div className="text-center mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <kbd className="font-sans px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">Enter</kbd> to send, <kbd className="font-sans px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
}
