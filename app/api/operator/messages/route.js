import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת הודעות
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('operator_messages')
      .select(`
        *,
        sender:sender_id(id, full_name, role)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // ההודעות הן פנימיות למוקד. מנהלת מוקד ואדמין רואים הכל, מוקדן רואה את
    // המיועדות לו; כל תפקיד אחר אינו חלק מהמוקד ואינו אמור לקרוא אותן.
    const isManager = decoded.role === 'call_center_manager' || decoded.role === 'admin';
    if (!isManager && decoded.role !== 'operator') {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }
    if (decoded.role === 'operator') {
      query = query.or(`target_role.is.null,target_role.eq.operator`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'שגיאה בטעינת הודעות' }, { status: 500 });
    }

    return NextResponse.json({ messages: data || [] });

  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// POST - שליחת הודעה (רק מנהלת מוקד)
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    if (decoded.role !== 'call_center_manager' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const { message_text, target_role, is_urgent } = await request.json();

    if (!message_text || !message_text.trim()) {
      return NextResponse.json({ error: 'נא להזין הודעה' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('operator_messages')
      .insert({
        sender_id: decoded.userId,
        message_text,
        target_role: target_role || null, // null = לכולם
        is_urgent: is_urgent || false,
        read_by: []
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: 'שגיאה בשליחת הודעה' }, { status: 500 });
    }

    return NextResponse.json({ message: data });

  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// PUT - סימון הודעה כנקראה
export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    // סימון "נקרא" הוא פעולה של אנשי המוקד בלבד. קודם כל משתמש מחובר, בכל
    // תפקיד, יכול היה לכתוב את עצמו ל-read_by של כל הודעה פנימית (YOA-27).
    if (!['operator', 'shift_supervisor', 'call_center_manager', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'חסר ID של הודעה' }, { status: 400 });
    }

    // קבל את ההודעה הנוכחית
    const { data: message } = await supabase
      .from('operator_messages')
      .select('read_by')
      .eq('id', id)
      .single();

    if (!message) {
      return NextResponse.json({ error: 'הודעה לא נמצאה' }, { status: 404 });
    }

    // הוסף את המשתמש למערך read_by אם הוא לא שם
    const readBy = message.read_by || [];
    if (!readBy.includes(decoded.userId)) {
      readBy.push(decoded.userId);

      const { error } = await supabase
        .from('operator_messages')
        .update({ read_by: readBy })
        .eq('id', id);

      if (error) {
        console.error('Error marking message as read:', error);
        return NextResponse.json({ error: 'שגיאה בעדכון הודעה' }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'הודעה סומנה כנקראה' });

  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}
