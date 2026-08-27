import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { getSession } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const room = await storage.rooms.getRoom(params.id);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const messages = await storage.messages.getMessages(params.id);
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
