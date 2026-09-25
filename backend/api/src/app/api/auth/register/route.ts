import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@smartpump/database';
import { hashPassword, signAccessToken } from '@smartpump/auth';
import { RegisterSchema } from '@smartpump/validation';
import { checkRateLimit, rateLimitResponse } from '@/middleware/rate-limiter';
import { SYSTEM_CONSTANTS } from '@smartpump/shared';

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
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.format() }, { status: 400 });
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
