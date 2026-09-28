import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@smartpump/database';
import { verifyPassword, signAccessToken, signRefreshToken } from '@smartpump/auth';
import { LoginSchema } from '@smartpump/validation';
import { checkRateLimit, rateLimitResponse } from '@/middleware/rate-limiter';
import { SYSTEM_CONSTANTS } from '@smartpump/shared';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateKey = `login:${ip}`;
  const { allowed } = checkRateLimit(rateKey, SYSTEM_CONSTANTS.RATE_LIMITS.AUTH_LOGIN.limit, SYSTEM_CONSTANTS.RATE_LIMITS.AUTH_LOGIN.windowMs);

  if (!allowed) {
    return rateLimitResponse();
  }

  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();

    console.log(`[Auth Login] Login attempt for "${cleanEmail}" from IP: ${ip}`);

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        _count: {
          select: { hardware: true }
        }
      }
    });

    if (!user) {
      console.warn(`[Auth Login Failed] No registered user found for email: "${cleanEmail}"`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      console.warn(`[Auth Login Failed] Password mismatch for: "${cleanEmail}"`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    console.log(`[Auth Login Success] User authenticated: "${cleanEmail}" (id: ${user.id})`);

    // Create session in database
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') || 'Flutter-Client',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const refreshToken = await signRefreshToken({
      userId: user.id,
      sessionId: session.id
    });

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        hasHardware: user._count.hardware > 0
      },
      tokens: {
        accessToken,
        expiresIn: 900
      }
    });

    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 900
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
