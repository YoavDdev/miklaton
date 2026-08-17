import { NextResponse } from 'next/server';
import { verifyToken, signToken, validatePassword } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - שינוי סיסמה
export async function POST(request) {
  console.log('🔵 API /api/profile/change-password - התחלה');
  try {
    const token = request.cookies.get('auth-token')?.value;
    console.log('🔑 Token exists:', !!token);

    if (!token) {
      return NextResponse.json(
        { error: 'לא מחובר' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    console.log('👤 Decoded user:', decoded?.userId, decoded?.role);
    if (!decoded) {
      return NextResponse.json(
        { error: 'טוקן לא תקין' },
        { status: 401 }
      );
    }

    // הגנה מפני ניחוש סיסמה — פר-משתמש (IP משותף לכל המוקד מאחורי NAT)
    const limited = rateLimit(request, `change-password:${decoded.userId}`, { limit: 5, windowMs: 60_000 });
    if (limited) return limited;

    const { currentPassword, newPassword } = await request.json();
    console.log('📝 Request data - currentPassword exists:', !!currentPassword, 'newPassword exists:', !!newPassword);

    // ולידציה
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'יש למלא את כל השדות' },
        { status: 400 }
      );
    }

    // מדיניות סיסמאות אחידה (8 תווים + מורכבות) — זהה להרשמה ולנתיב change-password
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: 'סיסמה לא תקינה', details: passwordErrors },
        { status: 400 }
      );
    }

    // אימות סיסמה נוכחית — על client חד-פעמי, כדי לא "להרעיל" את ה-client
    // המשותף ב-session של המשתמש (הכתיבות למטה חייבות service role).
    // האימייל מגיע מה-JWT (נחתם ב-login) — בלי listUsers על כל המשתמשים.
    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: signInData, error: signInError } = await verifyClient.auth.signInWithPassword({
      email: decoded.email,
      password: currentPassword
    });
    console.log('🔓 Password verification - error:', signInError?.message, 'success:', !!signInData?.user);

    if (signInError || !signInData.user) {
      console.log('❌ סיסמה נוכחית שגויה');
      return NextResponse.json(
        { error: 'סיסמה נוכחית שגויה' },
        { status: 401 }
      );
    }

    // עדכון הסיסמה
    console.log('🔄 מעדכן סיסמה עבור userId:', decoded.userId);
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      decoded.userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Password update error:', updateError);
      return NextResponse.json(
        { error: 'שגיאה בעדכון סיסמה' },
        { status: 500 }
      );
    }

    // עדכון שלא צריך לשנות סיסמה
    console.log('✅ סיסמה עודכנה בהצלחה, מעדכן must_change_password');
    await supabase
      .from('user_profiles')
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.userId);

    // סימון איפוסים פתוחים כמנוצלים — אחרת המשתמש יסומן שוב בהתחברות הבאה
    await supabase
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', decoded.userId)
      .is('used_at', null);

    console.log('🎉 הכל הצליח!');
    // הנפקת טוקן חדש בלי דגל mustChangePassword (ראה auth/change-password)
    const freshToken = signToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isAdmin: decoded.isAdmin,
      fullName: decoded.fullName,
      username: decoded.username,
      mustChangePassword: false,
    });

    const response = NextResponse.json({
      message: 'סיסמה שונתה בהצלחה'
    });
    response.cookies.set('auth-token', freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });
    return response;

  } catch (error) {
    console.error('❌❌❌ Change password API error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת', details: error.message },
      { status: 500 }
    );
  }
}
