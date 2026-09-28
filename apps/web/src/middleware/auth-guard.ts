import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenUserPayload } from '@smartpump/auth';

export interface AuthenticatedContext {
  user: TokenUserPayload;
}

/**
 * Authentication Guard
 * Extracts JWT from Authorization header or cookie and verifies token.
 */
export async function authenticateRequest(req: NextRequest): Promise<{ user: TokenUserPayload } | NextResponse> {
  const authHeader = req.headers.get('authorization');
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = req.cookies.get('accessToken')?.value;
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: Missing authentication token' }, { status: 401 });
  }

  const payload = await verifyToken<TokenUserPayload>(token);
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
  }

  return { user: payload };
}
