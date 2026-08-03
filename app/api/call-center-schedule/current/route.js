import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - fetch current and next shift for today
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'department_id required' }, { status: 400 });
    }

    // Server runs in UTC on Vercel - convert to Israel timezone (same pattern as duty-roster)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}:00`;

    const dayOfWeek = now.getDay();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

    // Yesterday's date info - overnight shifts (e.g. 23:00-07:00) that started
    // yesterday are still running after midnight but belong to yesterday's schedule
    const yesterdayDow = (dayOfWeek + 6) % 7;
    const yesterdayWeekStart = new Date(weekStart);
    if (dayOfWeek === 0) yesterdayWeekStart.setDate(yesterdayWeekStart.getDate() - 7);
    const yesterdayWeekStartStr = `${yesterdayWeekStart.getFullYear()}-${String(yesterdayWeekStart.getMonth() + 1).padStart(2, '0')}-${String(yesterdayWeekStart.getDate()).padStart(2, '0')}`;

    const selectQuery = `
        *,
        shift:call_center_shifts(*),
        staff:call_center_staff(*)
      `;

    const [todayRes, yesterdayRes] = await Promise.all([
      supabase.from('call_center_schedule').select(selectQuery)
        .eq('department_id', departmentId)
        .eq('week_start', weekStartStr)
        .eq('day_of_week', dayOfWeek),
      supabase.from('call_center_schedule').select(selectQuery)
        .eq('department_id', departmentId)
        .eq('week_start', yesterdayWeekStartStr)
        .eq('day_of_week', yesterdayDow)
    ]);

    if (todayRes.error) throw todayRes.error;
    if (yesterdayRes.error) throw yesterdayRes.error;

    const scheduleData = todayRes.data || [];
    const yesterdayData = yesterdayRes.data || [];

    if (scheduleData.length === 0 && yesterdayData.length === 0) {
      return NextResponse.json({
        success: true,
        current: null,
        next: null,
        nextShifts: [],
        activeShifts: [],
        message: 'אין משמרות מוגדרות להיום'
      });
    }

    // Group entries by shift
    const groupByShift = (entries) => {
      const groups = {};
      entries.forEach(entry => {
        const shiftId = entry.shift_id;
        if (!groups[shiftId]) {
          groups[shiftId] = {
            shift: entry.shift,
            managers: [],
            reps: []
          };
        }
        if (entry.position === 'אחמ"ש') {
          groups[shiftId].managers.push(entry.staff?.full_name || entry.staff_name);
        } else {
          groups[shiftId].reps.push(entry.staff?.full_name || entry.staff_name);
        }
      });
      return Object.values(groups);
    };

    const toShiftInfo = (group) => ({
      name: group.shift.name,
      startTime: group.shift.start_time,
      endTime: group.shift.end_time,
      managers: group.managers,
      reps: group.reps
    });

    const isOvernight = (startTime, endTime) => endTime < startTime;

    const activeShifts = [];
    const nextShifts = [];

    // Today's shifts: active now, or upcoming later today
    for (const group of groupByShift(scheduleData)) {
      const startTime = group.shift.start_time;
      const endTime = group.shift.end_time;

      const isActive = isOvernight(startTime, endTime)
        ? currentTime >= startTime // overnight shift: active from start until midnight
        : currentTime >= startTime && currentTime < endTime;

      if (isActive) {
        activeShifts.push(toShiftInfo(group));
      } else if (currentTime < startTime) {
        nextShifts.push(toShiftInfo(group));
      }
    }

    // Yesterday's overnight shifts still running after midnight (00:00 until end)
    for (const group of groupByShift(yesterdayData)) {
      const startTime = group.shift.start_time;
      const endTime = group.shift.end_time;
      if (isOvernight(startTime, endTime) && currentTime < endTime) {
        activeShifts.push(toShiftInfo(group));
      }
    }

    activeShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
    nextShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));

    console.log('[Call Center API] time:', currentTime, '| active:', activeShifts.map(s => s.name).join(','), '| next:', nextShifts.map(s => s.name).join(','));

    const response = NextResponse.json({
      success: true,
      activeShifts: activeShifts,
      current: activeShifts[0] || null, // For backward compatibility
      next: nextShifts[0] || null, // For backward compatibility
      nextShifts: nextShifts // All upcoming shifts today
    });
    
    // Prevent caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Error fetching current shift:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
