import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת משמרות כוננים
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const userId = searchParams.get('userId');

    let query = supabase
      .from('on_call_shifts')
      .select(`
        *,
        user:user_id(id, full_name, phone, role),
        created_user:created_by(id, full_name)
      `)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (date) {
      query = query.eq('shift_date', date);
    } else {
      // ברירת מחדל - 30 יום קדימה
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const future = futureDate.toISOString().split('T')[0];
      
      query = query.gte('shift_date', today).lte('shift_date', future);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching shifts:', error);
      return NextResponse.json({ error: 'שגיאה בטעינת משמרות' }, { status: 500 });
    }

    return NextResponse.json({ shifts: data || [] });

  } catch (error) {
    console.error('Shifts API error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// POST - הוספת משמרת כוננות (רק מנהלת מוקד)
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

    const { user_id, shift_date, shift_type, start_time, end_time, notes } = await request.json();

    if (!user_id || !shift_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('on_call_shifts')
      .insert({
        user_id,
        shift_date,
        shift_type: shift_type || 'יום',
        start_time,
        end_time,
        notes,
        created_by: decoded.userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating shift:', error);
      return NextResponse.json({ error: 'שגיאה ביצירת משמרת' }, { status: 500 });
    }

    return NextResponse.json({ shift: data });

  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// PUT - עדכון משמרת
export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    if (decoded.role !== 'call_center_manager' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const { id, user_id, shift_date, shift_type, start_time, end_time, notes } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'חסר ID של משמרת' }, { status: 400 });
    }

    const updateData = {};
    if (user_id) updateData.user_id = user_id;
    if (shift_date) updateData.shift_date = shift_date;
    if (shift_type) updateData.shift_type = shift_type;
    if (start_time) updateData.start_time = start_time;
    if (end_time) updateData.end_time = end_time;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('on_call_shifts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating shift:', error);
      return NextResponse.json({ error: 'שגיאה בעדכון משמרת' }, { status: 500 });
    }

    return NextResponse.json({ shift: data });

  } catch (error) {
    console.error('Update shift error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// DELETE - מחיקת משמרת
export async function DELETE(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    if (decoded.role !== 'call_center_manager' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'חסר ID של משמרת' }, { status: 400 });
    }

    const { error } = await supabase
      .from('on_call_shifts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting shift:', error);
      return NextResponse.json({ error: 'שגיאה במחיקת משמרת' }, { status: 500 });
    }

    return NextResponse.json({ message: 'משמרת נמחקה בהצלחה' });

  } catch (error) {
    console.error('Delete shift error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}
