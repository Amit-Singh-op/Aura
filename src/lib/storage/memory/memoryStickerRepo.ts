import { Sticker, StickerRepository } from '../types';
import crypto from 'crypto';

const stickers: Sticker[] = [];

export class MemoryStickerRepository implements StickerRepository {
  async createSticker(sticker: Omit<Sticker, 'id'>): Promise<Sticker> {
    const newSticker: Sticker = {
      ...sticker,
      id: crypto.randomUUID(),
    };
    stickers.push(newSticker);
    return newSticker;
  }

  async getSticker(id: string): Promise<Sticker | null> {
    return stickers.find(s => s.id === id) || null;
  }

  async getAllStickers(): Promise<Sticker[]> {
    return [...stickers];
  }
}
