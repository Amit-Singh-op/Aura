import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { storage } from '@/lib/storage';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await storage.notifications.markAsRead(params.id, session.userId);
  return NextResponse.json({ success: true });
}
