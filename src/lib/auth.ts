import { jwtVerify, SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET || 'super-secret-default-key-please-change';
const key = new TextEncoder().encode(secretKey);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: { userId: string; username: string; role: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload as { userId: string; username: string; role: string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const sessionToken = cookies().get('session')?.value;
  if (!sessionToken) return null;
  return verifyToken(sessionToken);
}

export async function setSession(token: string) {
  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export function clearSession() {
  cookies().delete('session');
}
