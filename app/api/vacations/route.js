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
        call_category:call_categories!call_category_contacts_call_category_id_fkey(
          id,
          name
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

    // Filter by municipality (category.municipality_id)
    const filtered = (vacations || []).filter(v => 
      v.call_category?.id && 
      v.call_category
    );

    return NextResponse.json({
      success: true,
      vacations: filtered
    });

  } catch (error) {
    console.error('Error fetching vacations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vacations', details: error.message },
      { status: 500 }
    );
  }
}
