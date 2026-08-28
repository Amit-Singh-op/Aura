import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { storage } from '@/lib/storage';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notifications = await storage.notifications.getUserNotifications(session.userId);
  return NextResponse.json(notifications);
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await storage.notifications.markAllAsRead(session.userId);
  return NextResponse.json({ success: true });
}
