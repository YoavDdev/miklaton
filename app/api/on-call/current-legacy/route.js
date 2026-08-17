import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * GET - Get current on-call contacts using EXISTING system
 * Uses: contacts + duty_roster tables (not the new on_call_contacts)
 */
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    // Get current time info
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
    const currentHour = now.getHours();

    // Get all active departments
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .eq('active', true)
      .order('display_order');

    if (deptError) throw deptError;

    // For each department, get current on-call contact
    const departmentsWithContacts = await Promise.all(
      departments.map(async (dept) => {
        // Get active duty roster for this department, day, and time
        const { data: duties, error: dutyError } = await supabase
          .from('duty_roster')
          .select(`
            *,
            contact:contacts(*)
          `)
          .eq('department_id', dept.id)
          .eq('day_of_week', dayOfWeek)
          .eq('active', true)
          .lte('start_hour', currentHour)
          .gte('end_hour', currentHour);

        if (dutyError) {
          console.error('Error fetching duties:', dutyError);
        }

        // Get the first active contact
        const activeContact = duties && duties.length > 0 ? duties[0].contact : null;

        // If no contact for current time, try to get any active contact for this department
        let fallbackContact = null;
        if (!activeContact) {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('department_id', dept.id)
            .eq('active', true)
            .limit(1);
          
          fallbackContact = contacts && contacts.length > 0 ? contacts[0] : null;
        }

        const contact = activeContact || fallbackContact;

        return {
          department: {
            id: dept.id,
            name: dept.name,
            icon: getIconForDepartment(dept.name),
            requires_24_7: false // We don't have this info in old schema
          },
          contact: contact ? {
            id: contact.id,
            name: contact.full_name,
            phone: contact.phone,
            email: null,
            is_external: false,
            external_company: null,
            is_default: false,
            role: contact.role
          } : null,
          has_contact: !!contact,
          alert: null
        };
      })
    );

    // Separate departments with and without contacts
    const withContacts = departmentsWithContacts.filter(d => d.has_contact);
    const withoutContacts = departmentsWithContacts.filter(d => !d.has_contact);

    return NextResponse.json({
      success: true,
      departments: departmentsWithContacts,
      summary: {
        total: departments.length,
        with_contacts: withContacts.length,
        without_contacts: withoutContacts.length,
        critical_missing: 0
      },
      alerts: []
    });

  } catch (error) {
    console.error('Error fetching current on-call:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current on-call contacts', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to get icon for department
function getIconForDepartment(name) {
  const iconMap = {
    'חשמל': '⚡',
    'מים': '💧',
    'ביוב': '🚰',
    'זבל': '🗑️',
    'כבישים': '🛣️',
    'גינון': '🌳',
    'רווחה': '🤝',
    'חינוך': '📚',
    'ביטחון': '🛡️',
    'תברואה': '🧹',
    'תחזוקה': '🔧'
  };

  // Try exact match
  if (iconMap[name]) return iconMap[name];

  // Try partial match
  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.includes(key)) return icon;
  }

  return '📋'; // Default icon
}
