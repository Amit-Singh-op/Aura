import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { storage } from '@/lib/storage';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await storage.users.getAllUsers();
  // Only return safe fields
  const safeUsers = users.map(u => ({ id: u.id, username: u.username }));
  
  return NextResponse.json(safeUsers);
}
