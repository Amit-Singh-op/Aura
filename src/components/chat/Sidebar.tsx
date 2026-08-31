'use client';
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useChatStore } from '@/store/chatStore';
import { Button } from '@/components/ui/button';
import { LogOut, Plus, Trash2, Users, Bell } from 'lucide-react';
import { Notification, Room } from '@/lib/storage/types';

export function Sidebar({ socket }: { socket: Socket | null }) {
  const { currentUser, setCurrentUser, rooms, setRooms, activeRoomId, setActiveRoomId } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomEmoji, setNewRoomEmoji] = useState('💬');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, setNotifications, addNotification, markNotificationAsRead, removeRoom, addRoom } = useChatStore();
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

    socket.on('room_added', (data: Room) => {
      // Check if room already exists to prevent duplication
      const currentRooms = useChatStore.getState().rooms;
      if (!currentRooms.find(r => r.id === data.id)) {
        addRoom(data);
      }
    });

    const handleConnect = () => {
      // Re-fetch state in case server restarted
      fetch('/api/rooms')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setRooms(data);
        })
        .catch(console.error);
    };

    socket.on('connect', handleConnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('initial_presence');
      socket.off('presence_update');
      socket.off('new_notification');
      socket.off('room_deleted');
      socket.off('room_added');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      if (!res.ok) throw new Error('Failed to create room');
      
      const newRoom = await res.json();
      addRoom(newRoom);
      setActiveRoomId(newRoom.id);
      setIsCreating(false);
      setNewRoomName('');
      if (socket) {
        socket.emit('add_room', newRoom);
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
    <div className="w-80 h-full flex flex-col bg-comic-bg border-r-4 border-comic-ink z-10 shrink-0">
      {/* Brand Header */}
      <div className="h-20 flex items-center gap-3 px-6 border-b-4 border-comic-ink bg-comic-yellow/20">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center -rotate-3 border-2 border-comic-ink shadow-comic bg-comic-pink text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 22h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-3xl font-heading font-extrabold text-comic-ink tracking-tight -rotate-1">
          Aura
        </h1>
      </div>

      {/* User Header */}
      <div className="py-4 flex items-center justify-between px-6 border-b-4 border-comic-ink bg-comic-bg">
        <div className="font-heading font-semibold text-lg text-comic-ink flex items-center gap-3">
          <div className="w-10 h-10 bg-comic-purple border-2 border-comic-ink rounded-full flex items-center justify-center text-white font-bold shadow-comic-sm">
            {currentUser?.username.charAt(0).toUpperCase()}
          </div>
          <span className="truncate">{currentUser?.username}</span>
          {currentUser?.role === 'admin' && (
            <span className="text-[10px] bg-comic-yellow text-comic-ink border border-comic-ink px-1.5 py-0.5 rounded-md uppercase font-bold tracking-wider rotate-2">Admin</span>
          )}
        </div>
        <div className="flex items-center gap-2 relative">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowNotifications(!showNotifications)} 
            className="hover:bg-comic-yellow/30 border-2 border-transparent hover:border-comic-ink rounded-full hover:shadow-comic-sm transition-all relative"
          >
            <Bell className="w-5 h-5 text-comic-ink" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-comic-pink border-2 border-comic-ink rounded-full animate-bounce"></span>
            )}
          </Button>

          {showNotifications && (
            <div className="absolute top-full right-0 mt-3 w-72 bg-comic-bg border-4 border-comic-ink rounded-2xl shadow-comic z-50 overflow-hidden">
              <div className="px-4 py-3 border-b-4 border-comic-ink bg-comic-teal/20 flex justify-between items-center">
                <span className="font-heading font-bold text-lg text-comic-ink">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-comic-pink text-white border-2 border-comic-ink px-2 py-0.5 rounded-full font-bold shadow-comic-sm">{unreadCount} new</span>
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
                      }}
                      className={`p-4 border-b-2 border-comic-ink cursor-pointer hover:bg-comic-yellow/20 transition-colors ${!n.read ? 'bg-comic-orange/20' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-comic-ink leading-snug mb-1">
                            <span className="text-comic-purple">@{n.fromUsername}</span> mentioned you! 🚨
                          </p>
                          <p className="text-xs text-comic-ink italic line-clamp-1 border-l-4 border-comic-ink pl-2 bg-white/50 py-1 rounded">
                            {n.content}
                          </p>
                        </div>
                        {!n.read && <div className="w-3 h-3 rounded-full bg-comic-pink border-2 border-comic-ink mt-1.5 shrink-0"></div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" className="hover:bg-comic-pink/20 border-2 border-transparent hover:border-comic-ink rounded-full hover:shadow-comic-sm transition-all">
            <LogOut className="w-5 h-5 text-comic-ink" />
          </Button>
        </div>
      </div>

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="font-heading text-lg font-bold text-comic-ink uppercase tracking-wider mb-2 px-2 flex justify-between items-center -rotate-1">
          <span>Rooms 🚀</span>
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => setIsCreating(!isCreating)}
              disabled={rooms.length >= 5}
              className="bg-comic-yellow border-2 border-comic-ink rounded-full p-1 shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={rooms.length >= 5 ? "Room limit reached" : "Create Room"}
            >
              <Plus className="w-5 h-5 text-comic-ink font-bold" />
            </button>
          )}
        </div>

        {isCreating && (
          <form onSubmit={handleCreateRoom} className="mb-4 bg-comic-purple/10 p-3 rounded-2xl border-2 border-comic-ink shadow-comic animate-in slide-in-from-top-2">
            <div className="flex gap-2 mb-3">
              <input 
                type="text" 
                value={newRoomEmoji} 
                onChange={e => setNewRoomEmoji(e.target.value)}
                maxLength={2}
                className="w-12 h-10 bg-white border-2 border-comic-ink rounded-xl text-center text-xl shadow-[2px_2px_0px_#2B1B3D] focus:outline-none focus:ring-2 focus:ring-comic-pink"
                placeholder="💬"
              />
              <input 
                type="text" 
                value={newRoomName} 
                onChange={e => setNewRoomName(e.target.value)}
                maxLength={20}
                placeholder="Room Name"
                className="flex-1 h-10 bg-white border-2 border-comic-ink rounded-xl px-3 font-semibold text-comic-ink shadow-[2px_2px_0px_#2B1B3D] focus:outline-none focus:ring-2 focus:ring-comic-pink"
                required
              />
            </div>
            {error && <p className="text-xs font-bold text-comic-pink mb-2">{error}</p>}
            <Button 
              type="submit" 
              disabled={loading || !newRoomName.trim()} 
              className="w-full bg-comic-teal hover:bg-comic-teal/90 text-comic-ink font-heading text-lg border-2 border-comic-ink rounded-xl shadow-comic hover:-translate-y-1 hover:shadow-comic-hover transition-all"
            >
              {loading ? 'Creating...' : 'Create Room 🎉'}
            </Button>
          </form>
        )}

        <div className="space-y-3">
          {rooms.map((room, idx) => {
            const isActive = room.id === activeRoomId;
            const rotation = isActive ? 'rotate-0' : (idx % 2 === 0 ? '-rotate-1' : 'rotate-1');
            return (
              <div key={room.id} className="relative group">
                <button
                  onClick={() => setActiveRoomId(room.id)}
                  className={`w-full text-left flex items-center justify-between p-3 rounded-2xl transition-all border-2 border-comic-ink shadow-comic hover:-translate-y-1 hover:shadow-comic-hover ${rotation}
                    ${isActive 
                      ? 'bg-comic-yellow' 
                      : 'bg-white hover:bg-comic-bg'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="text-2xl">{room.icon || '💬'}</span>
                    <span className={`font-heading text-lg truncate ${isActive ? 'font-bold text-comic-ink' : 'font-semibold text-comic-ink'}`}>
                      {room.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white border-2 border-comic-ink px-2 py-0.5 rounded-full shadow-comic-sm">
                      <div className={`w-2 h-2 rounded-full border border-comic-ink ${presence[room.id] > 0 ? 'bg-comic-teal' : 'bg-slate-300'}`}></div>
                      <span className="text-xs font-bold text-comic-ink">{presence[room.id] || 0}</span>
                    </div>
                  </div>
                </button>
                
                {currentUser?.role === 'admin' && room.name !== 'General' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteRoom(e, room.id)}
                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-comic-pink hover:bg-comic-pink border-2 border-comic-ink rounded-full text-white shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all w-8 h-8 z-10"
                    title="Delete Room"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>     </div>
    </div>
  );
}
