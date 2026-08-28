import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { authSchema } from '@/lib/schemas';
import { hashPassword, signToken, setSession } from '@/lib/auth';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = authSchema.parse(body);

    const existingUser = await storage.users.findUserByUsername(data.username);
    if (existingUser) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(data.password);
    const user = await storage.users.createUser({
      username: data.username,
      passwordHash: hashedPassword,
      role: 'user',
    });

    const token = await signToken({ userId: user.id, username: user.username, role: user.role });
    await setSession(token);

    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role },
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
