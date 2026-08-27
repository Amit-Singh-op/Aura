export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  savedStickers: string[];
}

export interface Sticker {
  id: string;
  url: string;
  name: string;
  createdBy: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: number;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string; // text content OR sticker url
  type?: 'text' | 'sticker' | 'power';
  stickerId?: string;
  powerOptions?: {
    textColor: string;
    bgColor: string;
  };
  timestamp: number;
  replyTo?: {
    id: string;
    username: string;
    content: string;
    type?: 'text' | 'sticker' | 'power';
  };
}

export interface UserRepository {
  createUser(user: Omit<User, 'id' | 'savedStickers'>): Promise<User>;
  findUserByUsername(username: string): Promise<User | null>;
  countUsers(): Promise<number>;
  saveStickerToUser(userId: string, stickerId: string): Promise<void>;
  getUserSavedStickers(userId: string): Promise<string[]>;
}

export interface StickerRepository {
  createSticker(sticker: Omit<Sticker, 'id'>): Promise<Sticker>;
  getSticker(id: string): Promise<Sticker | null>;
  getAllStickers(): Promise<Sticker[]>;
}

export interface RoomRepository {
  createRoom(room: Omit<Room, 'id' | 'createdAt'>): Promise<Room>;
  listRooms(): Promise<Room[]>;
  deleteRoom(id: string): Promise<void>;
  countRooms(): Promise<number>;
  getRoom(id: string): Promise<Room | null>;
}

export interface MessageRepository {
  addMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message>;
  getMessages(roomId: string): Promise<Message[]>;
}

export interface StorageBackend {
  users: UserRepository;
  rooms: RoomRepository;
  messages: MessageRepository;
  stickers: StickerRepository;
}
