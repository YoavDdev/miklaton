import { NextResponse } from 'next/server';
import { signToken, verifyOperatorPassword, verifyAdminPassword } from '@/lib/auth';

export async function POST(request) {
  try {
    const { password, adminPassword } = await request.json();

    let isAdmin = false;

    // If adminPassword is provided, user is trying to log in as admin
    if (adminPassword) {
      if (!verifyAdminPassword(adminPassword)) {
        return NextResponse.json(
          { error: 'סיסמת מנהל שגויה' },
          { status: 401 }
        );
      }
      isAdmin = true;
    } else {
      // Otherwise, user is trying to log in as operator
      if (!verifyOperatorPassword(password)) {
        return NextResponse.json(
          { error: 'סיסמת מוקדן שגויה' },
          { status: 401 }
        );
      }
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
