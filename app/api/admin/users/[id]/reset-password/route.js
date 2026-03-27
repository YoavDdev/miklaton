import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - איפוס סיסמה (Admin בלבד)
export async function POST(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { error: 'אין הרשאה - נדרש Admin' },
        { status: 403 }
      );
    }

    const userId = params.id;

    // יצירת סיסמה זמנית רנדומלית
    const tempPassword = generateTempPassword();

    // עדכון סיסמה ב-Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

    if (updateError) {
      console.error('Reset password error:', updateError);
      return NextResponse.json(
        { error: 'שגיאה באיפוס סיסמה' },
        { status: 500 }
      );
    }

    // שמירת הסיסמה הזמנית בטבלה
    const { error: insertError } = await supabase
      .from('password_resets')
      .insert({
        user_id: userId,
        temp_password_plain: tempPassword,
        must_change_password: true,
        reset_by: decoded.userId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });

    if (insertError) {
      console.error('Insert password reset error:', insertError);
    }

    // שליפת מידע על המשתמש
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, phone')
      .eq('id', userId)
      .single();

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: decoded.userId,
      action: 'password_reset_by_admin',
      resource_type: 'user',
      resource_id: userId,
      details: { user_name: profile?.full_name },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });

    return NextResponse.json({
      success: true,
      message: 'סיסמה אופסה בהצלחה',
      tempPassword, // סיסמה זמנית להצגה ל-Admin
      userName: profile?.full_name,
      userPhone: profile?.phone,
      whatsappMessage: generateWhatsAppMessage(profile?.full_name, tempPassword)
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'שגיאה באיפוס סיסמה', details: error.message },
      { status: 500 }
    );
  }
}

// יצירת סיסמה זמנית
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  let password = '';
  
  // מבטיח סיסמה עם אות גדולה, קטנה, מספר וסימן
  password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]; // אות גדולה
  password += 'abcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 23)]; // אות קטנה
  password += '23456789'[Math.floor(Math.random() * 8)]; // מספר
  password += '!@#$'[Math.floor(Math.random() * 4)]; // סימן
  
  // מוסיף עוד 4 תווים רנדומליים
  for (let i = 0; i < 4; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // מערבב את התווים
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// הודעת WhatsApp מוכנה
function generateWhatsAppMessage(userName, tempPassword) {
  return `היי ${userName}! 👋

איפסתי לך את הסיסמה למערכת מקלטון.

🔐 הסיסמה הזמנית: ${tempPassword}

⚠️ חשוב: 
• הסיסמה תקפה ל-24 שעות
• בהתחברות הבאה תתבקש לשנות לסיסמה אישית
• הסיסמה חייבת להכיל: 8+ תווים, אות גדולה, אות קטנה, ספרה

קישור למערכת: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://miklaton.yehud-monosson.muni.il'}

תודה!`;
}
