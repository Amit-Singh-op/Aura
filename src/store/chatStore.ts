import { create } from 'zustand';
import { Room, Message, User, Notification } from '@/lib/storage/types';

interface ChatState {
  currentUser: User | null;
  rooms: Room[];
  messages: Message[];
  activeRoomId: string | null;
  setCurrentUser: (user: User | null) => void;
  setRooms: (rooms: Room[]) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setActiveRoomId: (id: string | null) => void;
  addRoom: (room: Room) => void;
  removeRoom: (id: string) => void;
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (id: string) => void;
  updateMessageReactions: (roomId: string, messageId: string, reactions: Record<string, string[]>) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  currentUser: null,
  rooms: [],
  messages: [],
  activeRoomId: null,
  notifications: [],
  setCurrentUser: (user) => set({ currentUser: user }),
  setRooms: (rooms) => set({ rooms }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => {
    const newMessages = [...state.messages, message];
    if (newMessages.length > 100) {
      newMessages.shift(); // Evict oldest
    }
    return { messages: newMessages };
  }),
  setActiveRoomId: (id) => set({ activeRoomId: id }),
  addRoom: (room) => set((state) => ({ rooms: [room, ...state.rooms] })),
  removeRoom: (id) => set((state) => ({
    rooms: state.rooms.filter((r) => r.id !== id),
    activeRoomId: state.activeRoomId === id ? null : state.activeRoomId,
  })),
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) => set((state) => {
    // Only add if we don't already have it
    if (state.notifications.some(n => n.id === notification.id)) return state;
    return { notifications: [notification, ...state.notifications] };
  }),
  markNotificationAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),
  updateMessageReactions: (roomId, messageId, reactions) => set((state) => {
    if (state.activeRoomId !== roomId) return state;
    return {
      messages: state.messages.map(m => m.id === messageId ? { ...m, reactions } : m)
    };
  }),
}));
