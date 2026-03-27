import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// PUT - עדכון משתמש (Admin בלבד)
export async function PUT(request, { params }) {
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
    const { fullName, phone, role, departmentId, status } = await request.json();

    // עדכון profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        full_name: fullName,
        phone: phone || null,
        role,
        department_id: departmentId || null,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Update user error:', updateError);
      return NextResponse.json(
        { error: 'שגיאה בעדכון משתמש' },
        { status: 500 }
      );
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: decoded.userId,
      action: 'user_updated',
      resource_type: 'user',
      resource_id: userId,
      details: { full_name: fullName, role, status },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });

    return NextResponse.json({
      success: true,
      message: 'משתמש עודכן בהצלחה'
    });

  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'שגיאה בעדכון משתמש', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - מחיקת משתמש (Admin בלבד)
export async function DELETE(request, { params }) {
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

    // מחיקה מ-auth.users (יימחק גם מ-user_profiles בגלל CASCADE)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Delete user error:', deleteError);
      return NextResponse.json(
        { error: 'שגיאה במחיקת משתמש' },
        { status: 500 }
      );
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: decoded.userId,
      action: 'user_deleted',
      resource_type: 'user',
      resource_id: userId,
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent')
    });

    return NextResponse.json({
      success: true,
      message: 'משתמש נמחק בהצלחה'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'שגיאה במחיקת משתמש', details: error.message },
      { status: 500 }
    );
  }
}
