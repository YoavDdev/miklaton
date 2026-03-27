import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// PUT - עדכון פרטי פרופיל
export async function PUT(request) {
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

    const { full_name, phone } = await request.json();

    if (!full_name || !full_name.trim()) {
      return NextResponse.json(
        { error: 'שם מלא הוא שדה חובה' },
        { status: 400 }
      );
    }

    // עדכון הפרופיל
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.userId)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json(
        { error: 'שגיאה בעדכון פרופיל' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'פרופיל עודכן בהצלחה',
      profile: data
    });

  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת', details: error.message },
      { status: 500 }
    );
  }
}
