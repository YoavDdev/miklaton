import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// POST - bulk insert multiple schedule entries (for Excel import)
export async function POST(request) {
  try {
    const body = await request.json();
    const { department_id, week_start, entries } = body;

    if (!department_id || !week_start || !entries || !Array.isArray(entries)) {
      return NextResponse.json({ 
        success: false, 
        error: 'department_id, week_start, and entries array required' 
      }, { status: 400 });
    }

    if (entries.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No entries to insert' });
    }

    // Prepare entries for insertion
    const entriesToInsert = entries.map(entry => ({
      department_id,
      week_start,
      shift_id: entry.shift_id,
      staff_id: entry.staff_id,
      day_of_week: entry.day_of_week,
      is_backup: entry.is_backup || false,
      notes: entry.notes || null
    }));

    // Bulk insert
    const { data, error } = await supabase
      .from('security_weekly_schedule')
      .insert(entriesToInsert)
      .select(`
        *,
        shift:security_shifts(*),
        staff:security_staff(*)
      `);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      data 
    });
  } catch (error) {
    console.error('Bulk insert error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
