import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role key for admin operations
);

export async function POST(request) {
  try {
    const { email, password, fullName, phone, role } = await request.json();

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

    // Create user in Supabase Auth (using signUp instead of admin.createUser)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
          role: role || 'operator'
        }
      }
    });

    if (authError) {
      console.error('Supabase Auth Error:', authError);
      
      if (authError.message.includes('already registered')) {
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
        role: role || 'operator',
        status: 'pending'
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // אם נכשל ליצור profile, מוחקים את המשתמש
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'שגיאה ביצירת פרופיל משתמש', details: profileError.message },
        { status: 500 }
      );
    }

    // הוספת audit log
    await supabase.from('audit_log').insert({
      user_id: authData.user.id,
      action: 'user_registered',
      details: {
        email,
        full_name: fullName,
        role: role || 'operator'
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });

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
