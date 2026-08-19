import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { validatePassword } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role key for admin operations
);

export async function POST(request) {
  try {
    const limited = rateLimit(request, 'register', { limit: 5, windowMs: 60_000 });
    if (limited) return limited;

    const { email, password, fullName, phone } = await request.json();
    // הרשמה עצמית תמיד כמוקדן — תפקיד לעולם לא מתקבל מהלקוח (אדמין משנה אחרי אישור)
    const role = 'operator';

    // Validation
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'חסרים שדות חובה: אימייל, סיסמה, שם מלא' },
        { status: 400 }
      );
    }

    // Password validation
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: 'סיסמה לא תקינה', details: passwordErrors },
        { status: 400 }
      );
    }

    // יצירת משתמש דרך ה-admin API — לא signUp!
    // signUp על ה-client המשותף היה "מרעיל" אותו ב-session של המשתמש החדש,
    // וכל הכתיבות אחריו רצו כ-authenticated (שנחסם ב-RLS) במקום service role.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
        role
      }
    });

    if (authError) {
      console.error('Supabase Auth Error:', authError);

      if (/already.*registered|already.*exists/i.test(authError.message)) {
        return NextResponse.json(
          { error: 'האימייל כבר רשום במערכת' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'שגיאה ביצירת משתמש', details: authError.message },
        { status: 500 }
      );
    }

    // יצירת profile ידנית (ללא trigger)
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        full_name: fullName,
        phone: phone || null,
        role,
        status: 'pending'
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // אם נכשל ליצור profile, מוחקים את המשתמש
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(authData.user.id);
      if (cleanupError) console.error('register rollback (deleteUser) failed:', cleanupError);
      return NextResponse.json(
        { error: 'שגיאה ביצירת פרופיל משתמש', details: profileError.message },
        { status: 500 }
      );
    }

    // הוספת audit log
    const { error: auditError } = await supabase.from('audit_log').insert({
      user_id: authData.user.id,
      action: 'user_registered',
      details: {
        email,
        full_name: fullName,
        role
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });
    if (auditError) console.error('register audit write failed:', auditError);

    // בדיקה אם צריך אישור Admin
    const { data: settings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'require_admin_approval')
      .single();

    const requireApproval = settings?.value?.enabled ?? true;

    return NextResponse.json({
      success: true,
      message: requireApproval 
        ? 'חשבונך נוצר בהצלחה וממתין לאישור מנהל המערכת'
        : 'חשבונך נוצר בהצלחה! אתה יכול להתחבר עכשיו',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        status: requireApproval ? 'pending' : 'active'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'שגיאה כללית ברישום', details: error.message },
      { status: 500 }
    );
  }
}
