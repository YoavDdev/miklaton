import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - fetch current and next shift for today
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'department_id required' }, { status: 400 });
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    
    const dayOfWeek = now.getDay();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

    // Get today's schedule
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('call_center_schedule')
      .select(`
        *,
        shift:call_center_shifts(*),
        staff:call_center_staff(*)
      `)
      .eq('department_id', departmentId)
      .eq('week_start', weekStartStr)
      .eq('day_of_week', dayOfWeek);

    if (scheduleError) throw scheduleError;

    if (!scheduleData || scheduleData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        current: null, 
        next: null,
        message: 'אין משמרות מוגדרות להיום'
      });
    }

    // Group by shift
    const shiftGroups = {};
    scheduleData.forEach(entry => {
      const shiftId = entry.shift_id;
      if (!shiftGroups[shiftId]) {
        shiftGroups[shiftId] = {
          shift: entry.shift,
          managers: [],
          reps: []
        };
      }
      if (entry.position === 'אחמ"ש') {
        shiftGroups[shiftId].managers.push(entry.staff?.full_name || entry.staff_name);
      } else {
        shiftGroups[shiftId].reps.push(entry.staff?.full_name || entry.staff_name);
      }
    });

    // Find current and next shift
    let currentShift = null;
    let nextShift = null;

    const shifts = Object.values(shiftGroups);
    
    for (const group of shifts) {
      const startTime = group.shift.start_time;
      const endTime = group.shift.end_time;
      
      // Check if current time is within this shift
      if (currentTime >= startTime && currentTime < endTime) {
        currentShift = {
          name: group.shift.name,
          startTime: startTime,
          endTime: endTime,
          managers: group.managers,
          reps: group.reps
        };
      }
      
      // Check if this is the next shift
      if (currentTime < startTime) {
        if (!nextShift || startTime < nextShift.startTime) {
          nextShift = {
            name: group.shift.name,
            startTime: startTime,
            endTime: endTime,
            managers: group.managers,
            reps: group.reps
          };
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      current: currentShift,
      next: nextShift
    });
  } catch (error) {
    console.error('Error fetching current shift:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
