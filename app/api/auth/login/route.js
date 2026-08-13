import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const limited = rateLimit(request, 'login', { limit: 10, windowMs: 60_000 });
    if (limited) return limited;

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'נא להזין אימייל וסיסמה' },
        { status: 400 }
      );
    }

    // התחברות דרך Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Login error:', authError);
      
      // Audit log for failed login
      await supabase.from('audit_log').insert({
        action: 'login_failed',
        details: { email, reason: authError.message },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent')
      });

      return NextResponse.json(
        { error: 'אימייל או סיסמה שגויים' },
        { status: 401 }
      );
    }

    // שליפת פרופיל המשתמש
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'שגיאה בטעינת פרופיל המשתמש' },
        { status: 500 }
      );
    }

    // בדיקת סטטוס משתמש
    if (profile.status === 'pending') {
      return NextResponse.json(
        { error: 'חשבונך ממתין לאישור מנהל המערכת' },
        { status: 403 }
      );
    }

    if (profile.status === 'suspended') {
      return NextResponse.json(
        { error: 'חשבונך הושעה. נא לפנות למנהל המערכת' },
        { status: 403 }
      );
    }

    // בדיקה אם צריך להחליף סיסמה
    const { data: resetData } = await supabase
      .from('password_resets')
      .select('*')
      .eq('user_id', authData.user.id)
      .eq('must_change_password', true)
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .single();

    const mustChangePassword = !!resetData;

    // יצירת JWT token
    const token = signToken({ 
      userId: authData.user.id,
      email: authData.user.email,
      role: profile.role,
      isAdmin: profile.role === 'admin',
      fullName: profile.full_name || '',
      username: profile.full_name || authData.user.email?.split('@')[0] || '',
    });

    // Audit log for successful login
    await supabase.from('audit_log').insert({
      user_id: authData.user.id,
      action: 'login_success',
      details: { role: profile.role },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });

    const response = NextResponse.json({ 
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName: profile.full_name,
        role: profile.role,
        mustChangePassword
      },
      redirect: mustChangePassword ? '/change-password' : getRoleRedirect(profile.role)
    });

    // Set cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'שגיאה בהתחברות', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to determine redirect based on role - 7 תפקידים
function getRoleRedirect(role) {
  const redirectMap = {
    ceo: '/ceo',
    call_center_manager: '/call-center-manager',
    sector_manager: '/sector-manager',
    operator: '/operator',
    inspector: '/inspector',
    shelter_manager: '/shelter-manager',
    admin: '/admin/users'
  };
  
  return redirectMap[role] || '/dashboard';
}
