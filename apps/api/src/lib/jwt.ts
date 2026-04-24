import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ALG = 'HS256';

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 chars)');
  }
  return new TextEncoder().encode(s);
}

export async function signAccessToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<JWTPayload & { sub: string; email?: string }> {
  const { payload } = await jwtVerify(token, secret());
  if (typeof payload.sub !== 'string') throw new Error('Invalid token');
  return payload as JWTPayload & { sub: string; email?: string };
}
