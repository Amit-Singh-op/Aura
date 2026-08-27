import { User, UserRepository } from '../types';
import crypto from 'crypto';

// In-memory data structures
const users: User[] = [];

export class MemoryUserRepository implements UserRepository {
  async createUser(user: Omit<User, 'id' | 'savedStickers'>): Promise<User> {
    const newUser: User = {
      ...user,
      id: crypto.randomUUID(),
      savedStickers: [],
    };
    users.push(newUser);
    return newUser;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async countUsers(): Promise<number> {
    return users.length;
  }

  async saveStickerToUser(userId: string, stickerId: string): Promise<void> {
    const user = users.find(u => u.id === userId);
    if (user && !user.savedStickers.includes(stickerId)) {
      user.savedStickers.push(stickerId);
    }
  }

  async getUserSavedStickers(userId: string): Promise<string[]> {
    const user = users.find(u => u.id === userId);
    return user?.savedStickers || [];
  }
}
