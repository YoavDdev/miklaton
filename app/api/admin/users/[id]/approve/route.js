import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - אישור משתמש (Admin בלבד)
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

    // עדכון סטטוס ל-active
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        status: 'active',
        approved_by: decoded.userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Approve user error:', updateError);
      return NextResponse.json(
        { error: 'שגיאה באישור משתמש' },
        { status: 500 }
      );
    }

    // Audit log
    const { error: auditError } = await supabase.from('audit_log').insert({
      user_id: decoded.userId,
      action: 'user_approved',
      resource_type: 'user',
      resource_id: userId,
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });
    if (auditError) console.error('user_approved audit write failed:', auditError);

    return NextResponse.json({
      success: true,
      message: 'משתמש אושר בהצלחה'
    });

  } catch (error) {
    console.error('Approve user error:', error);
    return NextResponse.json(
      { error: 'שגיאה באישור משתמש', details: error.message },
      { status: 500 }
    );
  }
}
