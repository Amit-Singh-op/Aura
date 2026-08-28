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

  async toggleReaction(roomId: string, messageId: string, emoji: string, username: string): Promise<Record<string, string[]> | null> {
    const messages = roomMessages.get(roomId);
    if (!messages) return null;

    const message = messages.find(m => m.id === messageId);
    if (!message) return null;

    if (!message.reactions) {
      message.reactions = {};
    }

    const users = message.reactions[emoji] || [];
    const userIndex = users.indexOf(username);

    if (userIndex === -1) {
      // Add reaction
      message.reactions[emoji] = [...users, username];
    } else {
      // Remove reaction
      users.splice(userIndex, 1);
      if (users.length === 0) {
        delete message.reactions[emoji];
      } else {
        message.reactions[emoji] = [...users];
      }
    }

    return message.reactions;
  }
}
