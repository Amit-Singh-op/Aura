import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { getSession } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const savedStickerIds = await storage.users.getUserSavedStickers(session.userId);
  const allStickers = await storage.stickers.getAllStickers();
  const userStickers = allStickers.filter(s => savedStickerIds.includes(s.id));

  return NextResponse.json(userStickers);
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string || 'Custom Sticker';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'stickers');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename preserving extension
    const ext = path.extname(file.name) || '.png';
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, filename);

    // Save to disk
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/stickers/${filename}`;

    // Create the new sticker globally
    const sticker = await storage.stickers.createSticker({
      url: publicUrl,
      name,
      createdBy: session.userId,
    });

    // Automatically add to the creator's saved collection
    await storage.users.saveStickerToUser(session.userId, sticker.id);

    return NextResponse.json(sticker, { status: 201 });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
