import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - fetch department info + contacts for the form
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
    const { data: existingDuties, error: dutyError } = await supabase
      .from('duty_roster')
      .select('*')
      .in('contact_id', contactIds)
      .eq('active', true);

    if (dutyError) throw dutyError;

    return NextResponse.json({
      success: true,
      data: {
        department,
        existingDuties: existingDuties || []
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
    const { departmentId, entries, submittedBy } = body;

    // entries = [{ contact_id, dutyType: 'oncall'|'sleep', days: [{ day_of_week, start_hour, end_hour }] }]

    if (!departmentId || !entries || entries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'departmentId and entries are required' },
        { status: 400 }
      );
    }

    // Get all contact IDs for this department
    const contactIds = entries.map(e => e.contact_id);

    // Delete existing duties for these contacts (replace mode)
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

    return NextResponse.json({
      success: true,
      message: `נשמרו ${newEntries.length} כוננויות בהצלחה`,
      count: newEntries.length
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
