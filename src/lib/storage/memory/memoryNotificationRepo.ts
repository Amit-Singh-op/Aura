import { Notification, NotificationRepository } from '../types';
import crypto from 'crypto';

export class MemoryNotificationRepository implements NotificationRepository {
  private notifications: Notification[] = [];

  async createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false,
    };
    
    // Add to beginning of array for newest first
    this.notifications.unshift(newNotification);
    
    // Keep memory in check (max 100 notifications per user)
    const userNotifs = this.notifications.filter(n => n.userId === notification.userId);
    if (userNotifs.length > 100) {
      const oldestToRemove = userNotifs[userNotifs.length - 1];
      this.notifications = this.notifications.filter(n => n.id !== oldestToRemove.id);
    }
    
    return newNotification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return this.notifications.filter(n => n.userId === userId);
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === id && n.userId === userId);
    if (notification) {
      notification.read = true;
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    this.notifications.forEach(n => {
      if (n.userId === userId) {
        n.read = true;
      }
    });
  }
}
