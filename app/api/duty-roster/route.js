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

      const { data, error } = await supabase
        .from('duty_roster')
        .select(`
          *,
          contacts (*),
          departments (name)
        `)
        .eq('day_of_week', dayOfWeek)
        .lte('start_hour', currentHour)
        .gte('end_hour', currentHour)
        .eq('active', true);

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    } else {
      // Get all duty roster entries
      const { data, error } = await supabase
        .from('duty_roster')
        .select(`
          *,
          contacts (*),
          departments (name)
        `)
        .eq('active', true)
        .order('day_of_week')
        .order('start_hour');

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
    const { contact_id, department_id, day_of_week, start_hour, end_hour, notes } = body;

    const { data, error } = await supabase
      .from('duty_roster')
      .insert({ contact_id, department_id, day_of_week, start_hour, end_hour, notes })
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
