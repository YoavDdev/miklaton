import { NextResponse } from 'next/server';
import { verifyScheduleUploadToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

/**
 * מסלול העלאת סידור ביטחון מקישור חתום, בלי התחברות.
 *
 * מכוון בכוונה לצר ככל האפשר: הוא משרת מקרה שימוש אחד - מנהל שמעלה את קובץ
 * האקסל השבועי שלו - ולכן הוא מחזיר רק את מה שדרוש להתאמת השמות בקובץ,
 * בלי טלפונים ובלי שאר פרטי כוח האדם. כל השאר נשאר מאחורי אימות.
 */

function authorize(departmentId, token) {
  return Boolean(departmentId) && verifyScheduleUploadToken(departmentId, token);
}

// GET - הנתונים המינימליים שהיבואן צריך: שמות לצורך התאמה, וסוגי משמרת קיימים
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const token = searchParams.get('t');

    if (!authorize(departmentId, token)) {
      return NextResponse.json(
        { success: false, error: 'קישור לא תקין - יש לבקש קישור חדש מהמוקד' },
        { status: 401 }
      );
    }

    const { data: department, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('id', departmentId)
      .single();
    if (deptError) throw deptError;

    // id ו-full_name בלבד. הטלפונים אינם דרושים להתאמה ולכן אינם נחשפים.
    const { data: staff, error: staffError } = await supabase
      .from('security_staff')
      .select('id, full_name')
      .eq('department_id', departmentId)
      .eq('active', true);
    if (staffError) throw staffError;

    const { data: shifts, error: shiftsError } = await supabase
      .from('security_shifts')
      .select('id, category, start_time, end_time')
      .eq('department_id', departmentId)
      .eq('active', true);
    if (shiftsError) throw shiftsError;

    // עם week_start: מה כבר קיים בשבוע היעד, כדי שהתצוגה המקדימה תזהיר
    // לפני דריסה - קובץ ישן כבר דרס סידור עדכני בשקט (YOA-36)
    const weekStart = searchParams.get('week_start');
    let existingWeek;
    if (weekStart) {
      const { data: existing, error: existingError } = await supabase
        .from('security_weekly_schedule')
        .select('created_at')
        .eq('department_id', departmentId)
        .eq('week_start', weekStart);
      if (existingError) throw existingError;
      const rows = existing || [];
      existingWeek = {
        count: rows.length,
        last_updated: rows.reduce((m, r) => (r.created_at > m ? r.created_at : m), '') || null,
      };
    }

    return NextResponse.json({
      success: true,
      department,
      staff: staff || [],
      shifts: shifts || [],
      ...(existingWeek !== undefined ? { existingWeek } : {}),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - יצירת סוגי משמרת חסרים והחלפת הסידור של השבוע שבקובץ.
// המבנה זהה לראוט המאומת /api/security-schedule/bulk-insert - אותן עמודות,
// אותה סמנטיקה של החלפת שבוע - כדי ששני המסלולים לא יסטו זה מזה.
export async function POST(request) {
  try {
    const body = await request.json();
    const { department_id, token, week_start, newShifts, entries } = body;

    if (!authorize(department_id, token)) {
      return NextResponse.json(
        { success: false, error: 'קישור לא תקין - יש לבקש קישור חדש מהמוקד' },
        { status: 401 }
      );
    }

    if (!week_start || !Array.isArray(entries)) {
      return NextResponse.json(
        { success: false, error: 'week_start ו-entries נדרשים' },
        { status: 400 }
      );
    }

    // מיפוי מפתח-משמרת -> מזהה. המפתח שהיבואן מייצר הוא
    // `${category}|${start}|${end}` עם שעות מנורמלות ל-HH:MM.
    const normalizeTime = (t) => (t ? String(t).slice(0, 5) : '');
    const shiftIdByKey = new Map();

    const { data: existingShifts, error: shiftsError } = await supabase
      .from('security_shifts')
      .select('id, category, start_time, end_time')
      .eq('department_id', department_id)
      .eq('active', true);
    if (shiftsError) throw shiftsError;
    for (const sh of existingShifts || []) {
      shiftIdByKey.set(
        `${sh.category}|${normalizeTime(sh.start_time)}|${normalizeTime(sh.end_time)}`,
        sh.id
      );
    }

    // סוגי משמרת שהופיעו בקובץ ואינם קיימים עדיין. name הוא NOT NULL בסכימה.
    const createdShifts = [];
    for (const shift of newShifts || []) {
      const { data, error } = await supabase
        .from('security_shifts')
        .insert({
          department_id,
          category: shift.category,
          name: shift.name || `${shift.category} ${shift.start}-${shift.end}`,
          start_time: shift.start,
          end_time: shift.end,
        })
        .select()
        .single();
      if (error) throw error;
      shiftIdByKey.set(shift.key, data.id);
      createdShifts.push({ key: shift.key, id: data.id });
    }

    // החלפת השבוע: מוחקים את הקיים ומכניסים מחדש
    const { error: deleteError } = await supabase
      .from('security_weekly_schedule')
      .delete()
      .eq('department_id', department_id)
      .eq('week_start', week_start);
    if (deleteError) throw deleteError;

    let inserted = 0;
    if (entries.length > 0) {
      const unresolved = entries.filter((e) => !shiftIdByKey.has(e.shift_key));
      if (unresolved.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `לא זוהו סוגי משמרת: ${[...new Set(unresolved.map((e) => e.shift_key))].join(', ')}`,
          },
          { status: 400 }
        );
      }

      const rows = entries.map((e) => ({
        department_id,
        week_start,
        shift_id: shiftIdByKey.get(e.shift_key),
        staff_id: e.staff_id || null,
        staff_name: e.staff_id ? null : e.staff_name || null,
        day_of_week: e.day_of_week,
        is_backup: e.is_backup || false,
        // שעות שנכתבו בתא של העובד - השעות שבהן עובדים בפועל (YOA-37).
        // null = יורש את שעות המשמרת.
        actual_start: e.actual_start || null,
        actual_end: e.actual_end || null,
        notes: e.notes || null,
      }));
      const { error: insertError } = await supabase
        .from('security_weekly_schedule')
        .insert(rows);
      if (insertError) throw insertError;
      inserted = rows.length;
    }

    return NextResponse.json({
      success: true,
      count: inserted,
      createdShifts,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
