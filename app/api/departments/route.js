import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireRole, requireRoleOrScreen } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    const { data, error } = await supabase
      .from('departments')
      .select(`
        *,
        contacts (*)
      `)
      .eq('active', true)
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    console.log('POST /api/departments - Request body:', body);
    
    const { municipality_id, name, display_order, manager_name, manager_phone } = body;

    if (!municipality_id || !name) {
      return NextResponse.json(
        { success: false, error: 'municipality_id and name are required' },
        { status: 400 }
      );
    }

    // Get max display_order for this municipality
    const { data: maxOrder, error: maxOrderError } = await supabase
      .from('departments')
      .select('display_order')
      .eq('municipality_id', municipality_id)
      .order('display_order', { ascending: false })
      .limit(1);

    if (maxOrderError) {
      console.error('Error getting max display_order:', maxOrderError);
      throw maxOrderError;
    }

    const nextOrder = maxOrder && maxOrder.length > 0 ? maxOrder[0].display_order + 1 : 1;
    console.log('Next display_order:', nextOrder);

    const insertData = { 
      municipality_id,
      name, 
      display_order: display_order || nextOrder, 
      manager_name, 
      manager_phone,
      active: true
    };
    console.log('Inserting department:', insertData);

    const { data, error } = await supabase
      .from('departments')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error inserting department:', error);
      throw error;
    }

    console.log('Department created successfully:', data);
    return NextResponse.json({ success: true, data, message: 'מחלקה נוספה בהצלחה' });
  } catch (error) {
    console.error('POST /api/departments error:', error);
    return NextResponse.json(
      { success: false, error: error.message, details: error },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { id, name, display_order, active, manager_name, manager_phone } = body;

    const updateData = { name, display_order, active };
    if (manager_name !== undefined) updateData.manager_name = manager_name;
    if (manager_phone !== undefined) updateData.manager_phone = manager_phone;

    const { data, error } = await supabase
      .from('departments')
      .update(updateData)
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
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Department ID required' },
        { status: 400 }
      );
    }

    // Get all contacts for this department
    const { data: contacts } = await supabase
      .from('on_call_contacts')
      .select('id')
      .eq('department_id', id);

    // Delete all shifts for these contacts
    if (contacts && contacts.length > 0) {
      const contactIds = contacts.map(c => c.id);
      await supabase
        .from('on_call_shifts')
        .delete()
        .in('contact_id', contactIds);
    }

    // Delete all contacts for this department
    await supabase
      .from('on_call_contacts')
      .delete()
      .eq('department_id', id);

    // Delete the department
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'מחלקה נמחקה בהצלחה' });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
