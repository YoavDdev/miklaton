import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'טוקן לא תקין' }, { status: 401 });
    }

    return NextResponse.json({ isAdmin: decoded.isAdmin || false });
  } catch (error) {
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 });
  }
}
