import { NextResponse } from 'next/server';
import { getSession, clearSession } from '@/lib/auth';
import { storage } from '@/lib/storage';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  
  // Verify the user actually still exists in the database!
  // Otherwise, a server restart (which clears in-memory DB) leaves a "ghost" JWT cookie.
  const user = await storage.users.findUserByUsername(session.username);
  if (!user) {
    // Database wiped, but cookie survived. Force logout.
    clearSession();
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: session });
}
