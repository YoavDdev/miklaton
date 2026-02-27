import { NextResponse } from 'next/server';
import { signToken, verifyOperatorPassword, verifyAdminPassword } from '@/lib/auth';

export async function POST(request) {
  try {
    const { password, adminPassword } = await request.json();

    if (!verifyOperatorPassword(password)) {
      return NextResponse.json(
        { error: 'סיסמה שגויה' },
        { status: 401 }
      );
    }

    let isAdmin = false;
    if (adminPassword && verifyAdminPassword(adminPassword)) {
      isAdmin = true;
    }

    const token = signToken({ isAdmin });

    const response = NextResponse.json({ success: true, isAdmin });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'שגיאה בהתחברות' },
      { status: 500 }
    );
  }
}
