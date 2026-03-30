import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Get current on-call personnel based on current day and hour
export async function GET(request) {
  try {
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
      const { data: allDuties, error } = await supabase
        .from('duty_roster')
        .select(`
          *,
          contacts (*),
          departments (name)
        `)
        .in('day_of_week', [dayOfWeek, prevDay])
        .eq('active', true);

      if (error) throw error;

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
        query = query.eq('week_start_date', weekStartDate);
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
    const body = await request.json();
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
    const body = await request.json();
    const { id, contact_id, day_of_week, start_hour, end_hour, notes, active } = body;

    const { data, error } = await supabase
      .from('duty_roster')
      .update({ contact_id, day_of_week, start_hour, end_hour, notes, active })
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
