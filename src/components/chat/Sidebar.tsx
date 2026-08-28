'use client';
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useChatStore } from '@/store/chatStore';
import { Button } from '@/components/ui/button';
import { LogOut, Plus, Trash2, Users, Bell } from 'lucide-react';
import { Notification } from '@/lib/storage/types';

export function Sidebar({ socket }: { socket: Socket | null }) {
  const { currentUser, setCurrentUser, rooms, setRooms, activeRoomId, setActiveRoomId } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomEmoji, setNewRoomEmoji] = useState('💬');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, setNotifications, addNotification, markNotificationAsRead, removeRoom } = useChatStore();
  const unreadCount = notifications.filter(n => !n.read).length;

  // Presence counts from socket
  const [presence, setPresence] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRooms(data);
      })
      .catch(console.error);

    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(console.error);
  }, [setRooms, setNotifications]);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('initial_presence', (data: { roomId: string; count: number }[]) => {
      const initialCounts: Record<string, number> = {};
      data.forEach(p => { initialCounts[p.roomId] = p.count; });
      setPresence(initialCounts);
    });

    socket.on('presence_update', (data: { roomId: string; count: number }) => {
      setPresence(prev => ({ ...prev, [data.roomId]: data.count }));
    });

    socket.on('new_notification', (data: Notification) => {
      addNotification(data);
    });

    socket.on('room_deleted', (data: { id: string }) => {
      removeRoom(data.id);
    });

    return () => {
      socket.off('initial_presence');
      socket.off('presence_update');
      socket.off('new_notification');
      socket.off('room_deleted');
    };
  }, [socket]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rooms.length >= 5) {
      setError('Maximum 5 rooms allowed.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName, icon: newRoomEmoji }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setRooms([data, ...rooms]);
        setIsCreating(false);
        setNewRoomName('');
      }
    } catch (err) {
      setError('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this room?')) return;
    
    try {
      await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
      removeRoom(id);
      if (socket) {
        socket.emit('delete_room', { id });
      }
    } catch {
      console.error('Failed to delete room');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    if (socket) socket.disconnect();
  };

  return (
    <div className="w-80 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md border-r border-white/40 dark:border-slate-700/50 flex flex-col z-10">
      {/* App Branding */}
      <div className="pt-6 pb-2 px-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white text-sm">
          ✨
        </div>
        <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tight">
          Aura
        </h1>
      </div>

      {/* User Header */}
      <div className="py-4 flex items-center justify-between px-6 border-b border-white/40 dark:border-slate-700/50">
        <div className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
            {currentUser?.username.charAt(0).toUpperCase()}
          </div>
          <span className="truncate">{currentUser?.username}</span>
          {currentUser?.role === 'admin' && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>
          )}
        </div>
        <div className="flex items-center gap-1 relative">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowNotifications(!showNotifications)} 
            className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-xl relative"
          >
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
            )}
          </Button>

          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold">{unreadCount} new</span>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">No notifications yet.</div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id}
                      onClick={async () => {
                        setShowNotifications(false);
                        setActiveRoomId(n.roomId);
                        if (!n.read) {
                          markNotificationAsRead(n.id);
                          try { await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' }); } catch(e){}
                        }
                        setTimeout(() => {
                          const el = document.getElementById(`msg-bubble-${n.messageId}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('ring-4', 'ring-indigo-500', 'shadow-2xl');
                            setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500', 'shadow-2xl'), 2000);
                          }
                        }, 500);
                      }}
                      className={`p-4 border-b border-slate-100 dark:border-slate-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!n.read ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug mb-1">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">@{n.fromUsername}</span> mentioned you in a message.
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                            {n.content}
                          </p>
                        </div>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-xl">
            <LogOut className="w-4 h-4 text-slate-500" />
          </Button>
        </div>
      </div>

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-2 flex justify-between items-center">
          <span>Rooms</span>
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => setIsCreating(!isCreating)}
              disabled={rooms.length >= 5}
              className="hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title={rooms.length >= 5 ? "Room limit reached" : "Create Room"}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {isCreating && (
          <form onSubmit={handleCreateRoom} className="p-3 mb-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[1.5rem] border border-white/60 dark:border-slate-700/50 shadow-xl shadow-indigo-500/5 transform transition-all duration-300">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5 px-1 tracking-wide">Create New Room</h3>
            <div className="flex gap-2 mb-3">
              <input 
                value={newRoomEmoji}
                onChange={e => setNewRoomEmoji(e.target.value)}
                className="w-12 h-10 text-xl text-center rounded-full border border-white/60 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm"
                maxLength={2}
                title="Room Emoji"
              />
              <input 
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="Room name..."
                required
                className="flex-1 h-10 rounded-full border border-white/60 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-all shadow-sm"
              />
            </div>
            {error && <p className="text-xs text-red-500 font-medium mb-3 px-1">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)} className="h-8 rounded-full text-xs font-semibold hover:bg-slate-200/50 dark:hover:bg-slate-800/50">Cancel</Button>
              <Button type="submit" size="sm" className="h-8 rounded-full text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:scale-105 transition-all duration-200" disabled={loading}>
                Create Room
              </Button>
            </div>
          </form>
        )}

        {rooms.length === 0 && !isCreating ? (
          <div className="px-2 py-4 text-center text-sm text-slate-500">
            No rooms available.
          </div>
        ) : (
          rooms.map(room => (
            <div
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={`
                group flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300
                ${activeRoomId === room.id 
                  ? 'bg-white/80 dark:bg-slate-800/80 text-indigo-700 dark:text-indigo-300 shadow-sm border border-white dark:border-slate-700/50' 
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/40 hover:shadow-sm'}
              `}
            >
              <div className="flex items-center gap-3 truncate">
                <span className="text-xl drop-shadow-sm">{room.icon || '💬'}</span>
                <span className="font-semibold truncate">{room.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="w-3 h-3" />
                  {presence[room.id] || 0}
                </div>
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={(e) => handleDeleteRoom(e, room.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
