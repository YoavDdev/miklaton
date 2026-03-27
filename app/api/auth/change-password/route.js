import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

    // אם זה לא איפוס - צריך לוודא את הסיסמה הישנה
    const { data: resetData } = await supabase
      .from('password_resets')
      .select('*')
      .eq('user_id', decoded.userId)
      .eq('must_change_password', true)
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .single();

    const isPasswordReset = !!resetData;

    // אם לא איפוס - דורש סיסמה ישנה
    if (!isPasswordReset) {
      if (!oldPassword) {
        return NextResponse.json(
          { error: 'נא להזין את הסיסמה הנוכחית' },
          { status: 400 }
        );
      }

      // וידוא סיסמה ישנה
      const { data: user } = await supabase.auth.getUser(token);
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.user.email,
        password: oldPassword
      });

      if (verifyError) {
        return NextResponse.json(
          { error: 'הסיסמה הנוכחית שגויה' },
          { status: 401 }
        );
      }
    }

    // עדכון סיסמה ב-Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'שגיאה בעדכון סיסמה', details: updateError.message },
        { status: 500 }
      );
    }

    // אם זה היה איפוס - לסמן שהאיפוס נוצל
    if (isPasswordReset) {
      await supabase
        .from('password_resets')
        .update({ used_at: new Date().toISOString() })
        .eq('id', resetData.id);
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: decoded.userId,
      action: isPasswordReset ? 'password_changed_after_reset' : 'password_changed',
      details: { method: isPasswordReset ? 'forced_change' : 'voluntary_change' },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });

    return NextResponse.json({
      success: true,
      message: 'הסיסמה שונתה בהצלחה'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשינוי סיסמה', details: error.message },
      { status: 500 }
    );
  }
}

// Password validation helper
function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('הסיסמה חייבת להכיל לפחות 8 תווים');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('הסיסמה חייבת להכיל לפחות ספרה אחת');
  }
  
  return errors;
}
