import { create } from 'zustand';
import { Room, Message, User } from '@/lib/storage/types';

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
}

export const useChatStore = create<ChatState>((set) => ({
  currentUser: null,
  rooms: [],
  messages: [],
  activeRoomId: null,
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
}));
