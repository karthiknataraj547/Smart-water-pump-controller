import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/database';
import { hashPassword, signAccessToken } from '@/lib/server/auth';
import { RegisterSchema } from '@/lib/server/validation';
import { checkRateLimit, rateLimitResponse } from '@/middleware/rate-limiter';
import { SYSTEM_CONSTANTS } from '@/lib/server/shared';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateKey = `register:${ip}`;
  const { allowed } = checkRateLimit(rateKey, SYSTEM_CONSTANTS.RATE_LIMITS.AUTH_REGISTER.limit, SYSTEM_CONSTANTS.RATE_LIMITS.AUTH_REGISTER.windowMs);

  if (!allowed) {
    return rateLimitResponse();
  }

  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || 'Validation failed';
      console.warn('[Register Validation Failed]:', issue, parsed.error.issues);
      return NextResponse.json({ error: issue, details: parsed.error.format() }, { status: 400 });
    }

    const { email, password, fullName, phoneNumber } = parsed.data;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phoneNumber,
        notificationPreferences: {
          create: {}
        }
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      }
    });

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const response = NextResponse.json(
      {
        message: 'Account created successfully',
        user,
        tokens: { accessToken, expiresIn: 900 }
      },
      { status: 201 }
    );

    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 900
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
