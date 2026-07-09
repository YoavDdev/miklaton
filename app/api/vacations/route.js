import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - Get all active vacations across all categories
export async function GET(request) {
  try {
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
      .eq('on_vacation', true)
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
        updated_at
      `)
      .eq('on_vacation', true)
      .eq('active', true)
      .eq('municipality_id', municipalityId)
      .not('vacation_start', 'is', null)
      .not('vacation_end', 'is', null);

    console.log('Direct vacations query:', { directVacations, directError, municipalityId });

    // Normalize direct vacations to same shape as category vacations
    const normalizedDirect = (directVacations || []).map(v => ({
      id: v.id,
      external_name: v.name,
      external_phone: v.phone,
      on_vacation: v.on_vacation,
      vacation_start: v.vacation_start,
      vacation_end: v.vacation_end,
      vacation_reason: v.vacation_reason,
      updated_at: v.updated_at,
      call_category: null,
      replacement: null // TODO: fetch replacement separately if needed
    }));

    let recentlyReturned = [];

    // Optionally include contacts that returned from vacation in the last 24 hours
    if (includeRecentlyReturned) {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      const cutoffIso = cutoff.toISOString();

      const { data: returnedCategory, error: returnedCategoryError } = await supabase
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
        .eq('on_vacation', false)
        .eq('active', true)
        .gte('vacation_end', cutoffIso)
        .gte('updated_at', cutoffIso)
        .not('vacation_start', 'is', null)
        .not('vacation_end', 'is', null);

      if (returnedCategoryError) throw returnedCategoryError;

      const filteredReturnedCategory = (returnedCategory || []).filter(v =>
        v.call_category?.municipality_id === municipalityId
      );

      const { data: returnedDirect, error: returnedDirectError } = await supabase
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
          updated_at
        `)
        .eq('on_vacation', false)
        .eq('active', true)
        .eq('municipality_id', municipalityId)
        .gte('vacation_end', cutoffIso)
        .gte('updated_at', cutoffIso)
        .not('vacation_start', 'is', null)
        .not('vacation_end', 'is', null);

      if (returnedDirectError) throw returnedDirectError;

      const normalizedReturnedDirect = (returnedDirect || []).map(v => ({
        id: v.id,
        external_name: v.name,
        external_phone: v.phone,
        on_vacation: v.on_vacation,
        vacation_start: v.vacation_start,
        vacation_end: v.vacation_end,
        vacation_reason: v.vacation_reason,
        updated_at: v.updated_at,
        call_category: null,
        replacement: null
      }));

      recentlyReturned = [...filteredReturnedCategory, ...normalizedReturnedDirect];
    }

    return NextResponse.json({
      success: true,
      vacations: [...filtered, ...normalizedDirect, ...recentlyReturned]
    });

  } catch (error) {
    console.error('Error fetching vacations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vacations', details: error.message },
      { status: 500 }
    );
  }
}
