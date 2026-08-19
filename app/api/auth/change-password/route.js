import { NextResponse } from 'next/server';
import { verifyToken, signToken, validatePassword } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function PUT(request) {
  try {
    // בדיקת authentication
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'לא מחובר למערכת' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'טוקן לא תקף' },
        { status: 401 }
      );
    }

    // הגנה מפני ניחוש סיסמה — פר-משתמש (IP משותף לכל המוקד מאחורי NAT)
    const limited = rateLimit(request, `change-password:${decoded.userId}`, { limit: 5, windowMs: 60_000 });
    if (limited) return limited;

    const { oldPassword, newPassword } = await request.json();

    // Validation
    if (!newPassword) {
      return NextResponse.json(
        { error: 'נא להזין סיסמה חדשה' },
        { status: 400 }
      );
    }

    // Password strength validation
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: 'סיסמה לא תקינה', details: passwordErrors },
        { status: 400 }
      );
    }

    // האם יש איפוס פעיל? (רק לצורך audit וסימון ניצול — maybeSingle כי ייתכנו כמה)
    const { data: resetData } = await supabase
      .from('password_resets')
      .select('id')
      .eq('user_id', decoded.userId)
      .eq('must_change_password', true)
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const isPasswordReset = !!resetData;

    // הסיסמה הנוכחית נדרשת ומאומתת תמיד — גם באיפוס (שם היא הסיסמה הזמנית).
    // אחרת session גנוב שקדם לאיפוס היה יכול להשתלט על החשבון בלי שום סוד.
    if (!oldPassword) {
      return NextResponse.json(
        { error: isPasswordReset ? 'נא להזין את הסיסמה הזמנית שקיבלת' : 'נא להזין את הסיסמה הנוכחית' },
        { status: 400 }
      );
    }

    // אימות על client חד-פעמי, כדי לא "להרעיל" את ה-client המשותף
    // ב-session של המשתמש (הכתיבות למטה חייבות service role).
    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: decoded.email,
      password: oldPassword
    });

    if (verifyError) {
      return NextResponse.json(
        { error: isPasswordReset ? 'הסיסמה הזמנית שגויה' : 'הסיסמה הנוכחית שגויה' },
        { status: 401 }
      );
    }

    // עדכון סיסמה ב-Supabase Auth באמצעות admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      decoded.userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'שגיאה בעדכון סיסמה', details: updateError.message },
        { status: 500 }
      );
    }

    // עדכון must_change_password ל-false ב-user_profiles.
    // הסיסמה כבר שונתה - כשל כאן לא מפיל את הבקשה, אבל חייב להישמע:
    // המשמעות היא שהמשתמש יידרש להחליף סיסמה שוב בהתחברות הבאה.
    const { error: flagError } = await supabase
      .from('user_profiles')
      .update({ must_change_password: false })
      .eq('id', decoded.userId);
    if (flagError) console.error('must_change_password clear failed:', flagError);

    // סימון כל האיפוסים הפתוחים כמנוצלים (ייתכנו כמה אם האדמין איפס פעמיים)
    const { error: resetsError } = await supabase
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', decoded.userId)
      .is('used_at', null);
    if (resetsError) console.error('password_resets close failed:', resetsError);

    // Audit log
    const { error: auditError } = await supabase.from('audit_log').insert({
      user_id: decoded.userId,
      action: isPasswordReset ? 'password_changed_after_reset' : 'password_changed',
      details: { method: isPasswordReset ? 'forced_change' : 'voluntary_change' },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });
    if (auditError) console.error('change-password audit write failed:', auditError);

    // הנפקת טוקן חדש בלי דגל mustChangePassword — אחרת ה-middleware
    // ימשיך להפנות ל-/change-password עד ההתחברות הבאה
    const freshToken = signToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isAdmin: decoded.isAdmin,
      fullName: decoded.fullName,
      username: decoded.username,
      mustChangePassword: false,
      // נשמר בחתימה מחדש, אחרת זהות הרשות נעלמת אחרי החלפת סיסמה (YOA-29)
      municipalityId: decoded.municipalityId ?? null,
    });

    const response = NextResponse.json({
      success: true,
      message: 'הסיסמה שונתה בהצלחה'
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
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשינוי סיסמה', details: error.message },
      { status: 500 }
    );
  }
}
