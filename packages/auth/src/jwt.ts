import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'smartpump_super_secret_jwt_key_at_least_32_bytes_long!'
);

export interface TokenUserPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Sign a short-lived access token (15 minutes)
 */
export async function signAccessToken(payload: { userId: string; email: string; role: string }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

/**
 * Sign a rotating refresh token (30 days)
 */
export async function signRefreshToken(payload: { userId: string; sessionId: string }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

/**
 * Verify JWT token
 */
export async function verifyToken<T = TokenUserPayload>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as T;
  } catch {
    return null;
  }
}
