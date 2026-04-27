import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ALG = 'HS256';

function secret(secretValue: string): Uint8Array {
  if (!secretValue || secretValue.length < 32) {
    throw new Error('JWT secret must be set (min 32 chars)');
  }
  return new TextEncoder().encode(secretValue);
}

export async function signAccessToken(
  secretValue: string,
  userId: string,
  email: string,
): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret(secretValue));
}

export async function verifyAccessToken(
  secretValue: string,
  token: string,
): Promise<JWTPayload & { sub: string; email?: string }> {
  const { payload } = await jwtVerify(token, secret(secretValue));
  if (typeof payload.sub !== 'string') throw new Error('Invalid token');
  return payload as JWTPayload & { sub: string; email?: string };
}
