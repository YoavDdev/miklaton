import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת משימות (מנהלת רואה הכל, מוקדן רואה רק שלו)
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');

    let query = supabase
      .from('operator_tasks')
      .select(`
        *,
        assigned_user:assigned_to(id, full_name),
        created_user:created_by(id, full_name)
      `)
      .order('created_at', { ascending: false });

    // מנהלת מוקד רואה הכל, מוקדן רק את שלו
    if (decoded.role === 'operator') {
      query = query.eq('assigned_to', decoded.userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json({ error: 'שגיאה בטעינת משימות' }, { status: 500 });
    }

    return NextResponse.json({ tasks: data });

  } catch (error) {
    console.error('Tasks API error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// POST - יצירת משימה חדשה (רק מנהלת מוקד)
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

    const { title, description, assigned_to, priority, due_date } = await request.json();

    if (!title || !assigned_to) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('operator_tasks')
      .insert({
        title,
        description,
        assigned_to,
        created_by: decoded.userId,
        priority: priority || 'בינוני',
        due_date,
        status: 'ממתין'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return NextResponse.json({ error: 'שגיאה ביצירת משימה' }, { status: 500 });
    }

    return NextResponse.json({ task: data });

  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// PUT - עדכון משימה
export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    const { id, status, notes } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'חסר ID של משימה' }, { status: 400 });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    
    if (status === 'הושלם') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('operator_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return NextResponse.json({ error: 'שגיאה בעדכון משימה' }, { status: 500 });
    }

    return NextResponse.json({ task: data });

  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}
