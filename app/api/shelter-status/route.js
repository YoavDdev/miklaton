import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

export async function GET(request) {
  try {
    // שומר על צורת התשובה { statuses } גם בכישלון אימות - הצרכנים לא בודקים סטטוס
    const auth = await requireRole(request);
    if (auth.error) {
      return NextResponse.json({ statuses: {}, error: 'לא מחובר' }, { status: 401 });
    }
    const { data, error } = await supabase
      .from('shelter_status')
      .select('shelter_number, is_open, updated_at, updated_by')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Convert to the expected format
    const statuses = {};
    let lastUpdated = null;
    let updatedBy = null;

    if (data && data.length > 0) {
      data.forEach(row => {
        statuses[row.shelter_number] = row.is_open;
      });
      lastUpdated = data[0].updated_at;
      updatedBy = data[0].updated_by;
    }

    return NextResponse.json({
      statuses,
      lastUpdated,
      updatedBy
    });
  } catch (error) {
    console.error('Error fetching shelter status:', error);
    return NextResponse.json({ statuses: {} }, { status: 200 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireRole(request, ['operator', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { shelterNumber, isOpen, updatedBy } = body;

    if (!shelterNumber) {
      return NextResponse.json({ error: 'Shelter number is required' }, { status: 400 });
    }

    // Upsert the shelter status
    const { data, error } = await supabase
      .from('shelter_status')
      .upsert({
        shelter_number: shelterNumber,
        is_open: isOpen,
        updated_by: updatedBy || 'מוקדן'
      }, {
        onConflict: 'shelter_number'
      })
      .select();

    if (error) throw error;

    // Fetch all statuses to return
    const { data: allStatuses, error: fetchError } = await supabase
      .from('shelter_status')
      .select('shelter_number, is_open, updated_at, updated_by')
      .order('updated_at', { ascending: false });

    if (fetchError) throw fetchError;

    const statuses = {};
    let lastUpdated = null;
    let updatedByResult = null;

    if (allStatuses && allStatuses.length > 0) {
      allStatuses.forEach(row => {
        statuses[row.shelter_number] = row.is_open;
      });
      lastUpdated = allStatuses[0].updated_at;
      updatedByResult = allStatuses[0].updated_by;
    }

    return NextResponse.json({
      success: true,
      data: {
        statuses,
        lastUpdated,
        updatedBy: updatedByResult
      }
    });
  } catch (error) {
    console.error('Error updating shelter status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
