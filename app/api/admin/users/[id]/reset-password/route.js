import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - איפוס סיסמה (Admin בלבד)
export async function POST(request, { params }) {
  try {
    const limited = rateLimit(request, 'admin-reset-password', { limit: 5, windowMs: 60_000 });
    if (limited) return limited;

    const auth = await requireRole(request, ['admin']);
    if (auth.error) return auth.error;
    const decoded = auth.user;

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

    // רישום האיפוס — בלי הסיסמה עצמה (היא נמסרת פעם אחת בתשובה לאדמין בלבד)
    const { error: insertError } = await supabase
      .from('password_resets')
      .insert({
        user_id: userId,
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

// יצירת סיסמה זמנית — קריפטוגרפית, עם ערובת מורכבות (גדולה/קטנה/ספרה/סימן)
function generateTempPassword() {
  const pick = (set) => set[crypto.randomBytes(1)[0] % set.length];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';

  const required = [
    pick('ABCDEFGHJKLMNPQRSTUVWXYZ'),
    pick('abcdefghijkmnopqrstuvwxyz'),
    pick('23456789'),
    pick('!@#$'),
  ];
  const rest = Array.from({ length: 6 }, () => pick(chars));

  // ערבוב קריפטוגרפי (Fisher-Yates)
  const all = [...required, ...rest];
  for (let i = all.length - 1; i > 0; i--) {
    const j = crypto.randomBytes(1)[0] % (i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join('');
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
