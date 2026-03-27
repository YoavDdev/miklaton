import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת פרטי המשתמש המחובר
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'לא מחובר' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'טוקן לא תקין' },
        { status: 401 }
      );
    }

    // שליפת פרטי המשתמש
    console.log('🔍 Fetching profile for userId:', decoded.userId);
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    console.log('📋 Profile fetched from DB:', profile);
    console.log('🎯 department_id from DB:', profile?.department_id);
    console.log('❌ Error (if any):', error);

    if (error || !profile) {
      console.error('Profile fetch error:', error);
      return NextResponse.json(
        { error: 'משתמש לא נמצא' },
        { status: 404 }
      );
    }

    // בדיקת סטטוס
    if (profile.status === 'suspended') {
      return NextResponse.json(
        { error: 'חשבון מושעה' },
        { status: 403 }
      );
    }

    if (profile.status === 'pending') {
      return NextResponse.json(
        { error: 'חשבון ממתין לאישור' },
        { status: 403 }
      );
    }

    // שליפת אימייל מ-auth.users
    const { data: authUser } = await supabase.auth.admin.getUserById(decoded.userId);

    return NextResponse.json({
      user: {
        id: profile.id,
        email: authUser?.user?.email || '',
        full_name: profile.full_name,
        phone: profile.phone,
        role: profile.role,
        status: profile.status,
        avatar_url: profile.avatar_url,
        department_id: profile.department_id,
        created_at: profile.created_at
      }
    });

  } catch (error) {
    console.error('Me API error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת', details: error.message },
      { status: 500 }
    );
  }
}
