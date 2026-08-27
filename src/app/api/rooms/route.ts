import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createRoomSchema } from '@/lib/schemas';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rooms = await storage.rooms.listRooms();
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roomCount = await storage.rooms.countRooms();
    if (roomCount >= 5) {
      return NextResponse.json({ error: 'Maximum limit of 5 rooms reached' }, { status: 400 });
    }

    const body = await req.json();
    const data = createRoomSchema.parse(body);

    const room = await storage.rooms.createRoom({
      name: data.name,
      description: data.description,
      icon: data.icon,
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
