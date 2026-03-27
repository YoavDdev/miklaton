import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
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

    const { currentPassword, newPassword } = await request.json();
    console.log('📝 Request data - currentPassword exists:', !!currentPassword, 'newPassword exists:', !!newPassword);

    // ולידציה
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'יש למלא את כל השדות' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'סיסמה חדשה חייבת להכיל לפחות 6 תווים' },
        { status: 400 }
      );
    }

    // שליפת המשתמש מ-auth.users (email נמצא רק שם)
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData.users.find(u => u.id === decoded.userId);
    console.log('🔐 Auth user found:', !!authUser, 'email:', authUser?.email);

    if (!authUser) {
      console.log('❌ משתמש לא נמצא ב-auth.users');
      return NextResponse.json(
        { error: 'משתמש לא נמצא במערכת האימות' },
        { status: 404 }
      );
    }

    // אימות סיסמה נוכחית - ניסיון התחברות
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPassword
    });
    console.log('🔓 Password verification - error:', signInError?.message, 'success:', !!signInData.user);

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

    console.log('🎉 הכל הצליח!');
    return NextResponse.json({
      message: 'סיסמה שונתה בהצלחה'
    });

  } catch (error) {
    console.error('❌❌❌ Change password API error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשרת', details: error.message },
      { status: 500 }
    );
  }
}
