import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { stickerId } = await req.json();
    if (!stickerId || typeof stickerId !== 'string') {
      return NextResponse.json({ error: 'Invalid stickerId' }, { status: 400 });
    }

    // Check if sticker exists
    const sticker = await storage.stickers.getSticker(stickerId);
    if (!sticker) {
      return NextResponse.json({ error: 'Sticker not found' }, { status: 404 });
    }

    // Add to user's collection
    await storage.users.saveStickerToUser(session.userId, stickerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
