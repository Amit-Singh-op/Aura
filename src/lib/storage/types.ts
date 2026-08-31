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
  pendingId?: string;
  deliveredTo?: string[];
  seenBy?: string[];
  replyTo?: {
    id: string;
    username: string;
    content: string;
    type?: 'text' | 'sticker' | 'power';
  };
  reactions?: Record<string, string[]>; // Map of emoji -> array of usernames (or userIds, let's use usernames for UI simplicity, but I'll use usernames since UI uses usernames heavily, actually userIds is safer. Let's use usernames to easily show who reacted)
}

export interface Notification {
  id: string;
  userId: string;
  fromUsername: string;
  roomId: string;
  messageId: string;
  content: string;
  read: boolean;
  timestamp: number;
}

export interface UserRepository {
  createUser(user: Omit<User, 'id' | 'savedStickers'>): Promise<User>;
  findUserByUsername(username: string): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
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
  toggleReaction(roomId: string, messageId: string, emoji: string, username: string): Promise<Record<string, string[]> | null>;
  updateMessageStatus(roomId: string, messageId: string, userId: string, status: 'delivered' | 'seen'): Promise<{ deliveredTo?: string[], seenBy?: string[] } | null>;
}

export interface NotificationRepository {
  createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markAsRead(id: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
}

export interface StorageBackend {
  users: UserRepository;
  rooms: RoomRepository;
  messages: MessageRepository;
  stickers: StickerRepository;
  notifications: NotificationRepository;
}
