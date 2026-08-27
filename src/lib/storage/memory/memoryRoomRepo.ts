import { Room, RoomRepository } from '../types';
import crypto from 'crypto';

const rooms: Room[] = [];

export class MemoryRoomRepository implements RoomRepository {
  async createRoom(room: Omit<Room, 'id' | 'createdAt'>): Promise<Room> {
    const newRoom: Room = {
      ...room,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    rooms.push(newRoom);
    return newRoom;
  }

  async listRooms(): Promise<Room[]> {
    return [...rooms].sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteRoom(id: string): Promise<void> {
    const index = rooms.findIndex((r) => r.id === id);
    if (index !== -1) {
      rooms.splice(index, 1);
    }
  }

  async countRooms(): Promise<number> {
    return rooms.length;
  }

  async getRoom(id: string): Promise<Room | null> {
    return rooms.find((r) => r.id === id) || null;
  }
}
