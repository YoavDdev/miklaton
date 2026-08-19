import { NextResponse } from 'next/server';
import { requireRole, requireRoleOrScreen, requireDepartmentAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// GET - fetch daily order for a specific date (auto-merge with weekly schedule)
export async function GET(request) {
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const orderDate = searchParams.get('order_date');

    if (!departmentId || !orderDate) {
      return NextResponse.json({ success: false, error: 'department_id and order_date required' }, { status: 400 });
    }

    // 1. Get weekly schedule for this day
    const date = new Date(orderDate + 'T00:00:00');
    const dayOfWeek = date.getDay();
    
    // Calculate week_start for the schedule query
    const weekStartDate = new Date(date);
    weekStartDate.setDate(weekStartDate.getDate() - dayOfWeek);
    const weekStartStr = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`;
    
    const { data: scheduleEntries, error: scheduleError } = await supabase
      .from('security_weekly_schedule')
      .select(`
        *,
        shift:security_shifts(*),
        staff:security_staff(*)
      `)
      .eq('department_id', departmentId)
      .eq('week_start', weekStartStr)
      .eq('day_of_week', dayOfWeek);
    
    if (scheduleError) throw scheduleError;

    // 2. Get saved daily order details
    let { data: order, error: orderError } = await supabase
      .from('security_daily_orders')
      .select('*')
      .eq('department_id', departmentId)
      .eq('order_date', orderDate)
      .single();

    // If order not found, that's ok - we'll still return schedule entries
    const orderExists = order && !orderError;
    
    let savedEntries = [];
    if (orderExists) {
      const { data: entries, error: entriesError } = await supabase
        .from('security_daily_order_entries')
        .select(`
          *,
          staff:security_staff(*)
        `)
        .eq('order_id', order.id)
        .order('category')
        .order('display_order');
      
      if (entriesError) throw entriesError;
      savedEntries = entries || [];
    }

    // 3. Merge: weekly schedule + saved details
    const savedEntriesMap = new Map(savedEntries.map(e => [`${e.staff_id}-${e.start_time}`, e]));
    
    const merged = (scheduleEntries || []).map(entry => {
      // שעות בפועל מהתא באקסל גוברות על שעות המשמרת - ככה המנהל עושה
      // שינויים במשמרת (YOA-37). המשמרת היא ברירת המחדל בלבד.
      const startTime = entry.actual_start?.slice(0, 5) || entry.shift?.start_time || '07:00';
      const endTime = entry.actual_end?.slice(0, 5) || entry.shift?.end_time || '15:00';
      const category = entry.shift?.category || entry.staff?.role || 'פיקוח';
      
      // Check if we have saved details for this staff+time
      const savedDetail = savedEntriesMap.get(`${entry.staff_id}-${startTime}`);
      
      return {
        id: savedDetail?.id || null,
        staff_id: entry.staff_id,
        staff_name: entry.staff?.full_name || '',
        category,
        role_title: category === 'שיטור' ? 'שיטור עירוני' : 'פיקוח עירוני',
        vehicle: savedDetail?.vehicle || '',
        start_time: startTime,
        end_time: endTime,
        is_backup: entry.is_backup || false,
        tasks: savedDetail?.tasks || [],
        special_notes: savedDetail?.special_notes || '',
        display_order: savedDetail?.display_order || 0,
        staff: entry.staff,
        from_schedule: true
      };
    });
    
    // 4. Add any manual entries that were saved but not in schedule
    savedEntries.forEach(saved => {
      const key = `${saved.staff_id}-${saved.start_time}`;
      const existsInSchedule = merged.some(m => `${m.staff_id}-${m.start_time}` === key);
      if (!existsInSchedule) {
        merged.push({
          ...saved,
          from_schedule: false
        });
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: orderExists ? order : null, 
      entries: merged 
    });
  } catch (error) {
    console.error('Error in GET security-daily-order:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create or update daily order with entries
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { department_id, order_date, general_notes, signoff_message, entries } = body;
    const deptAccess = await requireDepartmentAccess(request, department_id);
    if (deptAccess.error) return deptAccess.error;


    if (!department_id || !order_date) {
      return NextResponse.json({ success: false, error: 'department_id and order_date required' }, { status: 400 });
    }

    // Upsert the daily order
    const { data: order, error: orderError } = await supabase
      .from('security_daily_orders')
      .upsert({
        department_id,
        order_date,
        general_notes: general_notes || '',
        signoff_message: signoff_message || 'יום טוב לכולם, סעו בזהירות, שמרו על עצמכם',
        updated_at: new Date().toISOString()
      }, { onConflict: 'department_id,order_date' })
      .select()
      .single();

    if (orderError) throw orderError;

    // If entries provided, delete old ones and insert new
    if (entries && Array.isArray(entries)) {
      // Delete existing entries. כשל שקט כאן היה משאיר את הישנות ומוסיף
      // את החדשות - פקודת יום כפולה.
      const { error: deleteError } = await supabase
        .from('security_daily_order_entries')
        .delete()
        .eq('order_id', order.id);
      if (deleteError) throw deleteError;

      // Insert new entries
      if (entries.length > 0) {
        const entriesToInsert = entries.map((entry, idx) => ({
          order_id: order.id,
          staff_id: entry.staff_id || null,
          staff_name: entry.staff_name || null,
          category: entry.category || 'פיקוח',
          role_title: entry.role_title || 'פיקוח עירוני',
          vehicle: entry.vehicle || null,
          start_time: entry.start_time || '07:00',
          end_time: entry.end_time || '15:00',
          is_backup: entry.is_backup || false,
          tasks: entry.tasks || [],
          special_notes: entry.special_notes || null,
          display_order: idx
        }));

        const { error: insertError } = await supabase
          .from('security_daily_order_entries')
          .insert(entriesToInsert);

        if (insertError) throw insertError;
      }
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - update only the daily order metadata (notes, signoff)
export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { id, general_notes, signoff_message } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (general_notes !== undefined) updateData.general_notes = general_notes;
    if (signoff_message !== undefined) updateData.signoff_message = signoff_message;

    const { data, error } = await supabase
      .from('security_daily_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
