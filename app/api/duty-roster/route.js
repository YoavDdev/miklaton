import { NextResponse } from 'next/server';
import { requireRole, requireRoleOrScreen, verifyDutyFormToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// Get current on-call personnel based on current day and hour
export async function GET(request) {
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const getCurrentOnly = searchParams.get('current') === 'true';

    if (getCurrentOnly) {
      // Get current day and hour in Israel timezone (UTC+2 or UTC+3)
      const now = new Date();
      const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      const dayOfWeek = israelTime.getDay(); // 0=Sunday
      const currentHour = israelTime.getHours();

      const prevDay = (dayOfWeek + 6) % 7;

      // Get duties for today AND yesterday (for overnight shifts)
      const { data: weekDuties, error } = await supabase
        .from('duty_roster')
        .select(`
          *,
          contacts (*),
          departments (name)
        `)
        .in('day_of_week', [dayOfWeek, prevDay])
        .eq('active', true)
        .not('week_start_date', 'is', null);

      if (error) throw error;

      // Also get permanent duties (week_start_date IS NULL) for today
      const { data: permDuties, error: permError } = await supabase
        .from('duty_roster')
        .select(`
          *,
          contacts (*),
          departments (name)
        `)
        .in('day_of_week', [dayOfWeek, prevDay])
        .eq('active', true)
        .is('week_start_date', null);

      if (permError) throw permError;

      const allDuties = [...(weekDuties || []), ...(permDuties || [])];

      // Filter to find who is currently on-call:
      // 1. Today's duties: 24h, normal, or overnight (active from start to midnight)
      // 2. Yesterday's overnight duties spilling into today (active from midnight to end)
      const currentDuties = allDuties.filter(duty => {
        const { start_hour, end_hour } = duty;
        
        if (duty.day_of_week === dayOfWeek) {
          // Today's duties
          if (start_hour === end_hour) return true; // 24h
          if (end_hour < start_hour && end_hour !== 0) return currentHour >= start_hour; // overnight start
          if (end_hour === 0) return currentHour >= start_hour; // until midnight
          return currentHour >= start_hour && currentHour < end_hour; // normal
        }
        
        if (duty.day_of_week === prevDay) {
          // Yesterday's overnight shift spilling into today
          if (end_hour < start_hour && end_hour !== 0) return currentHour < end_hour;
        }
        
        return false;
      });

      return NextResponse.json({ success: true, data: currentDuties });
    } else {
      // Get duty roster entries, optionally filtered by week
      const weekStartDate = searchParams.get('week_start_date');
      
      let query = supabase
        .from('duty_roster')
        .select(`
          *,
          contacts (*),
          departments (name)
        `)
        .eq('active', true);
      
      if (weekStartDate) {
        // Get both week-specific AND permanent (week_start_date IS NULL) duties
        const { data: weekData, error: weekError } = await supabase
          .from('duty_roster')
          .select(`
            *,
            contacts (*),
            departments (name)
          `)
          .eq('active', true)
          .eq('week_start_date', weekStartDate)
          .order('day_of_week')
          .order('start_hour');

        if (weekError) throw weekError;

        const { data: permanentData, error: permError } = await supabase
          .from('duty_roster')
          .select(`
            *,
            contacts (*),
            departments (name)
          `)
          .eq('active', true)
          .is('week_start_date', null)
          .order('day_of_week')
          .order('start_hour');

        if (permError) throw permError;

        const combined = [...(permanentData || []), ...(weekData || [])];
        return NextResponse.json({ success: true, data: combined });
      }
      
      query = query.order('day_of_week').order('start_hour');

      const { data, error } = await query;

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();

    // הוספה מרובה (למשל כונן קבוע 24/7 - שבע רשומות, אחת לכל יום)
    if (Array.isArray(body.entries)) {
      const rows = body.entries.map(e => ({
        contact_id: e.contact_id,
        department_id: e.department_id,
        day_of_week: e.day_of_week,
        start_hour: e.start_hour,
        end_hour: e.end_hour,
        notes: e.notes,
        week_start_date: e.week_start_date ?? null,
      }));

      const { data, error } = await supabase
        .from('duty_roster')
        .insert(rows)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    const { contact_id, department_id, day_of_week, start_hour, end_hour, notes, week_start_date } = body;

    const insertData = { contact_id, department_id, day_of_week, start_hour, end_hour, notes };
    if (week_start_date) insertData.week_start_date = week_start_date;

    const { data, error } = await supabase
      .from('duty_roster')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { id, contact_id, day_of_week, start_hour, end_hour, notes, active, week_start_date } = body;

    const updateData = { contact_id, day_of_week, start_hour, end_hour, notes, active };
    if (week_start_date !== undefined) updateData.week_start_date = week_start_date;

    const { data, error } = await supabase
      .from('duty_roster')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);

    // מחיקה מרוכזת של כוננויות שבוע שלם (לייבוא מ-Excel) - לא נוגעת בכוננים קבועים
    if (searchParams.get('bulk') === 'true') {
      if (auth.error) return auth.error;
      const departmentId = searchParams.get('department_id');
      const weekStartDate = searchParams.get('week_start_date');
      if (!departmentId || !weekStartDate) {
        return NextResponse.json({ success: false, error: 'department_id and week_start_date required' }, { status: 400 });
      }

      const { error } = await supabase
        .from('duty_roster')
        .delete()
        .eq('department_id', departmentId)
        .eq('week_start_date', weekStartDate);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // מחיקת כוננות קבועה (כל הרשומות ללא week_start_date) - למנהלים מחוברים בלבד
    if (searchParams.get('permanent') === 'true') {
      if (auth.error) return auth.error;
      const contactId = searchParams.get('contact_id');
      const departmentId = searchParams.get('department_id');
      if (!contactId || !departmentId) {
        return NextResponse.json({ success: false, error: 'contact_id and department_id required' }, { status: 400 });
      }

      const { error } = await supabase
        .from('duty_roster')
        .delete()
        .eq('contact_id', contactId)
        .eq('department_id', departmentId)
        .is('week_start_date', null);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    // מותר: מנהל מחובר, או טוקן חתום של המכלול שאליו שייכת התורנות (מדף /duty-form)
    if (auth.error) {
      const { data: duty } = await supabase
        .from('duty_roster')
        .select('department_id')
        .eq('id', id)
        .single();
      if (!duty || !verifyDutyFormToken(duty.department_id, searchParams.get('t'))) {
        return auth.error;
      }
    }

    const { error } = await supabase
      .from('duty_roster')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
