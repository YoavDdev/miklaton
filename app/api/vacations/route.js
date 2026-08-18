import { NextResponse } from 'next/server';
import { requireRoleOrScreen } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

function getIsraelDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getPreviousDateString(dateString) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return getIsraelDateString(date);
}

function wasUpdatedWithinLast24Hours(updatedAt) {
  if (!updatedAt) return false;
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  return elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000;
}

// GET - Get all active vacations across all categories
export async function GET(request) {
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const municipalityId = searchParams.get('municipality_id');
    const includeRecentlyReturned = searchParams.get('include_recently_returned') === 'true';

    if (!municipalityId) {
      return NextResponse.json({ error: 'municipality_id required' }, { status: 400 });
    }

    // Get all contacts on vacation with their category info
    const { data: vacations, error } = await supabase
      .from('call_category_contacts')
      .select(`
        id,
        external_name,
        external_phone,
        on_vacation,
        vacation_start,
        vacation_end,
        vacation_reason,
        replacement_contact_id,
        replacement_note,
        updated_at,
        call_category:call_categories!call_category_contacts_call_category_id_fkey(
          id,
          name,
          municipality_id
        ),
        replacement:on_call_contacts!fk_replacement_contact(
          id,
          name,
          phone
        )
      `)
      .eq('active', true)
      .not('vacation_start', 'is', null)
      .not('vacation_end', 'is', null);

    if (error) throw error;

    // Filter by municipality
    const filtered = (vacations || []).filter(v => 
      v.call_category?.municipality_id === municipalityId
    );

    // Also fetch vacations from on_call_contacts (contacts not tied to any category)
    const { data: directVacations, error: directError } = await supabase
      .from('on_call_contacts')
      .select(`
        id,
        name,
        phone,
        on_vacation,
        vacation_start,
        vacation_end,
        vacation_reason,
        municipality_id,
        replacement_contact_id,
        replacement_note,
        updated_at
      `)
      .eq('active', true)
      .eq('municipality_id', municipalityId)
      .not('vacation_start', 'is', null)
      .not('vacation_end', 'is', null);

    if (directError) throw directError;

    // Normalize direct vacations to same shape as category vacations
    const normalizedDirect = (directVacations || []).map(v => ({
      id: v.id,
      external_name: v.name,
      external_phone: v.phone,
      on_vacation: v.on_vacation,
      vacation_start: v.vacation_start,
      vacation_end: v.vacation_end,
      vacation_reason: v.vacation_reason,
      replacement_note: v.replacement_note,
      updated_at: v.updated_at,
      call_category: null,
      replacement: null // TODO: fetch replacement separately if needed
    }));

    const today = getIsraelDateString();
    const yesterday = getPreviousDateString(today);
    const allVacationRecords = [...filtered, ...normalizedDirect];
    const activeVacations = allVacationRecords.filter(v =>
      v.on_vacation && v.vacation_end >= today
    );
    const automaticallyReturned = allVacationRecords
      .filter(v => v.on_vacation && v.vacation_end === yesterday)
      .map(v => ({ ...v, on_vacation: false, automatically_returned: true }));
    const manuallyReturned = allVacationRecords.filter(v =>
      !v.on_vacation && wasUpdatedWithinLast24Hours(v.updated_at)
    );

    return NextResponse.json({
      success: true,
      vacations: includeRecentlyReturned
        ? [...activeVacations, ...automaticallyReturned, ...manuallyReturned]
        : activeVacations
    });

  } catch (error) {
    console.error('Error fetching vacations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vacations', details: error.message },
      { status: 500 }
    );
  }
}
