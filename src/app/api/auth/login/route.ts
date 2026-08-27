import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { authSchema } from '@/lib/schemas';
import { verifyPassword, signToken, setSession } from '@/lib/auth';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = authSchema.parse(body);

    const user = await storage.users.findUserByUsername(data.username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = await signToken({ userId: user.id, username: user.username, role: user.role });
    await setSession(token);

    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
