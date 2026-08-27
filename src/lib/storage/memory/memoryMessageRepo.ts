import { Message, MessageRepository } from '../types';
import crypto from 'crypto';

// Map of roomId -> Message[]
// Using a simple array with shifting to maintain the 100 limit
const roomMessages = new Map<string, Message[]>();
const MAX_MESSAGES = 100;

export class MemoryMessageRepository implements MessageRepository {
  async addMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      replyTo: message.replyTo,
    };

    if (!roomMessages.has(message.roomId)) {
      roomMessages.set(message.roomId, []);
    }

    const messages = roomMessages.get(message.roomId)!;
    messages.push(newMessage);

    if (messages.length > MAX_MESSAGES) {
      messages.shift(); // Remove the oldest message (at index 0)
    }

    return newMessage;
  }

  async getMessages(roomId: string): Promise<Message[]> {
    return roomMessages.get(roomId) || [];
  }
}
