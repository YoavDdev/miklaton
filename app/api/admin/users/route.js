import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role for admin operations
);

// GET - רשימת כל המשתמשים (Admin בלבד)
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { error: 'אין הרשאה - נדרש Admin' },
        { status: 403 }
      );
    }

    // שליפת כל המשתמשים עם הפרופילים שלהם
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'שגיאה בטעינת משתמשים' },
        { status: 500 }
      );
    }

    // שליפת מידע נוסף מ-auth.users
    const usersWithAuth = await Promise.all(
      profiles.map(async (profile) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        
        return {
          ...profile,
          email: authUser?.user?.email,
          last_sign_in_at: authUser?.user?.last_sign_in_at,
          email_confirmed_at: authUser?.user?.email_confirmed_at
        };
      })
    );

    return NextResponse.json({
      success: true,
      users: usersWithAuth
    });

  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'שגיאה כללית', details: error.message },
      { status: 500 }
    );
  }
}

// POST - יצירת משתמש חדש ע"י Admin
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { error: 'אין הרשאה - נדרש Admin' },
        { status: 403 }
      );
    }

    const { email, password, fullName, phone, role, departmentId, status, mustChangePassword } = await request.json();

    // Validation
    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { error: 'חסרים שדות חובה' },
        { status: 400 }
      );
    }

    // יצירת משתמש
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
        role: role
      }
    });

    if (authError) {
      console.error('Create user error:', authError);
      return NextResponse.json(
        { error: 'שגיאה ביצירת משתמש', details: authError.message },
        { status: 500 }
      );
    }

    // יצירה/עדכון הפרופיל - upsert כדי לוודא שהוא קיים
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: authData.user.id,
        full_name: fullName,
        phone: phone || null,
        role,
        department_id: departmentId || null,
        status: status || 'active',
        must_change_password: mustChangePassword !== undefined ? mustChangePassword : true,
        approved_by: decoded.userId,
        approved_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      return NextResponse.json(
        { error: 'שגיאה ביצירת פרופיל משתמש', details: profileError.message },
        { status: 500 }
      );
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: decoded.userId,
      action: 'user_created_by_admin',
      resource_type: 'user',
      resource_id: authData.user.id,
      details: { email, role, full_name: fullName },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });

    return NextResponse.json({
      success: true,
      message: 'משתמש נוצר בהצלחה',
      user: {
        id: authData.user.id,
        email: authData.user.email
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'שגיאה ביצירת משתמש', details: error.message },
      { status: 500 }
    );
  }
}
