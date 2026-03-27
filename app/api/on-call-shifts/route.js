import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת כוננויות מ-duty_roster
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('duty_roster')
      .select(`
        *,
        contact:contacts(id, full_name, phone, role),
        department:departments(id, name)
      `)
      .eq('active', true)
      .order('day_of_week')
      .order('start_hour');

    if (error) {
      console.error('Error fetching duty roster:', error);
      return NextResponse.json({ error: 'שגיאה בטעינת כוננויות' }, { status: 500 });
    }

    return NextResponse.json({ shifts: data || [] });

  } catch (error) {
    console.error('Duty roster API error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// POST - הוספת כוננות (רק מנהלת מוקד)
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

    const { contact_id, department_id, day_of_week, start_hour, end_hour, notes } = await request.json();

    if (!contact_id || !department_id || day_of_week === undefined || start_hour === undefined || end_hour === undefined) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('duty_roster')
      .insert({
        contact_id,
        department_id,
        day_of_week,
        start_hour,
        end_hour,
        notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating duty:', error);
      return NextResponse.json({ error: 'שגיאה ביצירת כוננות' }, { status: 500 });
    }

    return NextResponse.json({ shift: data });

  } catch (error) {
    console.error('Create duty error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// PATCH - עדכון כוננות (משתמש ב-PATCH כמו ה-API המקורי)
export async function PATCH(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    if (decoded.role !== 'call_center_manager' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const { id, contact_id, department_id, day_of_week, start_hour, end_hour, notes, active } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'חסר ID של כוננות' }, { status: 400 });
    }

    const updateData = {};
    if (contact_id) updateData.contact_id = contact_id;
    if (department_id) updateData.department_id = department_id;
    if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
    if (start_hour !== undefined) updateData.start_hour = start_hour;
    if (end_hour !== undefined) updateData.end_hour = end_hour;
    if (notes !== undefined) updateData.notes = notes;
    if (active !== undefined) updateData.active = active;

    const { data, error } = await supabase
      .from('duty_roster')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating duty:', error);
      return NextResponse.json({ error: 'שגיאה בעדכון כוננות' }, { status: 500 });
    }

    return NextResponse.json({ shift: data });

  } catch (error) {
    console.error('Update duty error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// DELETE - מחיקת כוננות
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
      return NextResponse.json({ error: 'חסר ID של כוננות' }, { status: 400 });
    }

    const { error } = await supabase
      .from('duty_roster')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting duty:', error);
      return NextResponse.json({ error: 'שגיאה במחיקת כוננות' }, { status: 500 });
    }

    return NextResponse.json({ message: 'כוננות נמחקה בהצלחה' });

  } catch (error) {
    console.error('Delete duty error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}
