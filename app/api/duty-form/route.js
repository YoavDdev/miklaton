import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { verifyAuth, verifyDutyFormToken } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * שער הגישה לטופס התורנות של מכלול מסוים.
 *
 * שני מסלולים לגיטימיים:
 *   1. אנונימי עם טוקן HMAC מהקישור שנשלח בוואטסאפ - תקף למכלול שלו בלבד.
 *   2. משתמש מחובר - אבל רק אם המכלול שייך לו.
 *
 * קודם המסלול השני קיבל כל משתמש מחובר לכל מכלול, כי departmentId נלקח
 * מהבקשה ולא הושווה לכלום. כלומר כל מוקדן יכול היה לדרוס את הכוננויות של
 * כל מכלול אחר (YOA-22).
 */
async function authorizeDutyForm(request, departmentId, token) {
  if (verifyDutyFormToken(departmentId, token)) return { ok: true };

  const authResult = await verifyAuth(request);
  if (!authResult.valid) return { ok: false };

  const { role, userId } = authResult.user;

  // מנהלת המוקד ואדמין מנהלים את התורנויות של כל המכלולים - זה הממשק
  // שממנו נשלחים הקישורים מלכתחילה.
  if (role === 'call_center_manager' || role === 'admin') return { ok: true };

  // מנהל מכלול - רק המכלול שלו, לפי הפרופיל בשרת ולא לפי הבקשה.
  if (role === 'sector_manager') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('department_id')
      .eq('id', userId)
      .single();
    if (profile?.department_id && profile.department_id === departmentId) return { ok: true };
  }

  return { ok: false };
}

// GET - fetch department info + contacts + full duty roster for the form
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'departmentId is required' },
        { status: 400 }
      );
    }

    const access = await authorizeDutyForm(request, departmentId, searchParams.get('t'));
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: 'קישור לא תקין - יש לבקש קישור חדש מהמוקד' },
        { status: 401 }
      );
    }

    // Fetch department with its contacts
    const { data: department, error: deptError } = await supabase
      .from('departments')
      .select(`
        id,
        name,
        contacts (id, full_name, phone, role)
      `)
      .eq('id', departmentId)
      .eq('active', true)
      .single();

    if (deptError) throw deptError;

    // Fetch existing duty roster for this department's contacts
    const contactIds = department.contacts.map(c => c.id);
    let existingDuties = [];
    if (contactIds.length > 0) {
      const { data, error: dutyError } = await supabase
        .from('duty_roster')
        .select('*')
        .in('contact_id', contactIds)
        .eq('active', true);

      if (dutyError) throw dutyError;
      existingDuties = data || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        department,
        existingDuties
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - submit duty roster from manager form
export async function POST(request) {
  try {
    const body = await request.json();
    const { departmentId, entries, newContacts, submittedBy, token } = body;

    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'departmentId is required' },
        { status: 400 }
      );
    }

    const access = await authorizeDutyForm(request, departmentId, token);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: 'קישור לא תקין - יש לבקש קישור חדש מהמוקד' },
        { status: 401 }
      );
    }

    let createdContacts = [];

    // Step 1: Create new contacts if any
    if (newContacts && newContacts.length > 0) {
      for (const nc of newContacts) {
        if (!nc.full_name) continue;
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            full_name: nc.full_name,
            phone: nc.phone || '',
            department_id: departmentId,
            role: nc.role || '',
            active: true
          })
          .select()
          .single();

        if (error) throw error;
        createdContacts.push(data);

        // Add duty entries for the new contact
        if (nc.days && nc.days.length > 0) {
          const typeTag = nc.dutyType === 'sleep' ? '[לן]' : '[כונן]';
          const noteParts = [typeTag];
          if (submittedBy) noteParts.push(`עודכן ע"י ${submittedBy}`);

          const newDuties = nc.days.map(day => ({
            contact_id: data.id,
            department_id: departmentId,
            day_of_week: day.day_of_week,
            start_hour: day.start_hour,
            end_hour: day.end_hour,
            notes: noteParts.join(' | '),
            active: true
          }));

          const { error: insertError } = await supabase
            .from('duty_roster')
            .insert(newDuties);
          if (insertError) throw insertError;
        }
      }
    }

    // Step 2: Update existing contacts' duties (only for contacts included in entries)
    let updatedCount = 0;
    if (entries && entries.length > 0) {
      const contactIds = entries.map(e => e.contact_id);

      // Delete existing duties only for submitted contacts
      const { error: deleteError } = await supabase
        .from('duty_roster')
        .delete()
        .in('contact_id', contactIds);

      if (deleteError) throw deleteError;

      // Build new duty roster entries
      const newEntries = [];
      for (const entry of entries) {
        if (!entry.days || entry.days.length === 0) continue;
        
        for (const day of entry.days) {
          const typeTag = entry.dutyType === 'sleep' ? '[לן]' : '[כונן]';
          const noteParts = [typeTag];
          if (submittedBy) noteParts.push(`עודכן ע"י ${submittedBy}`);
          
          newEntries.push({
            contact_id: entry.contact_id,
            department_id: departmentId,
            day_of_week: day.day_of_week,
            start_hour: day.start_hour,
            end_hour: day.end_hour,
            notes: noteParts.join(' | '),
            active: true
          });
        }
      }

      if (newEntries.length > 0) {
        const { error: insertError } = await supabase
          .from('duty_roster')
          .insert(newEntries);

        if (insertError) throw insertError;
      }
      updatedCount = newEntries.length;
    }

    return NextResponse.json({
      success: true,
      message: `נשמרו ${updatedCount} כוננויות בהצלחה`,
      count: updatedCount,
      newContacts: createdContacts.length
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
