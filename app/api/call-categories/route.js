import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Resolve municipality slug (e.g. 'yehud') to UUID if needed
async function resolveMunicipalityId(municipalityId) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(municipalityId)) return municipalityId;

  const { data, error } = await supabase
    .from('municipalities')
    .select('id')
    .eq('code', municipalityId)
    .single();

  if (error || !data) {
    throw new Error(`Municipality not found for code: ${municipalityId}`);
  }

  return data.id;
}

// GET - Get all call categories with contacts
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const municipalityId = searchParams.get('municipality_id');
    const currentTimeOnly = searchParams.get('current_time') === 'true'; // Filter by current availability

    if (!municipalityId) {
      return NextResponse.json({ error: 'municipality_id required' }, { status: 400 });
    }

    const resolvedMunicipalityId = await resolveMunicipalityId(municipalityId);

    // Get all categories
    const { data: categories, error: catError } = await supabase
      .from('call_categories')
      .select('*')
      .eq('municipality_id', resolvedMunicipalityId)
      .eq('active', true)
      .order('display_order');

    if (catError) throw catError;

    // Fetch shabbat times if filtering by current availability
    let shabbatTimes = null;
    if (currentTimeOnly) {
      try {
        // Fetch directly from Hebcal API
        const shabbatRes = await fetch('https://www.hebcal.com/shabbat?cfg=json&geonameid=293397&m=50');
        const shabbatData = await shabbatRes.json();
        if (shabbatData.items) {
          const candles = shabbatData.items.find(i => i.category === 'candles');
          const havdalah = shabbatData.items.find(i => i.category === 'havdalah');
          if (candles && havdalah) {
            shabbatTimes = {
              candleLighting: new Date(candles.date),
              havdalah: new Date(havdalah.date),
            };
          }
        }
      } catch (e) {
        console.error('Failed to fetch shabbat times:', e);
      }
    }

    // For each category, get contacts, rules, and subcategories
    const categoriesWithDetails = await Promise.all(
      categories.map(async (category) => {
        // Get contacts
        const { data: contacts, error: contactsError } = await supabase
          .from('call_category_contacts')
          .select(`
            *,
            contact:on_call_contacts!call_category_contacts_contact_id_fkey(*),
            replacement:on_call_contacts!fk_replacement_contact(*)
          `)
          .eq('call_category_id', category.id)
          .eq('active', true)
          .order('escalation_order');

        if (contactsError) {
          console.error('Error fetching contacts:', contactsError);
        }

        // Filter contacts by availability if requested
        let filteredContacts = contacts || [];
        if (currentTimeOnly && filteredContacts.length > 0) {
          const now = new Date();
          // Use Israel local time for all comparisons (stored hours are in IST)
          const israelNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
          const currentDay = israelNow.getDay(); // 0=Sunday, 6=Saturday
          const currentTime = israelNow.toTimeString().slice(0, 5); // HH:MM in IST
          const currentDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD in IST

          filteredContacts = filteredContacts.filter(contact => {
            // Check if on vacation
            if (contact.on_vacation) {
              if (contact.vacation_start && contact.vacation_end) {
                if (currentDate >= contact.vacation_start && currentDate <= contact.vacation_end) {
                  // If has replacement, keep the contact (will be swapped to replacement in frontend)
                  // If no replacement, filter out
                  return contact.replacement_contact_id ? true : false;
                }
              } else {
                // On vacation but no dates - filter out unless has replacement
                return contact.replacement_contact_id ? true : false;
              }
            }

            // Check if currently unavailable
            if (contact.currently_unavailable) {
              if (!contact.unavailable_until || new Date(contact.unavailable_until) > now) {
                return false;
              }
            }

            // Check day of week
            if (contact.available_days && contact.available_days.length > 0) {
              if (!contact.available_days.includes(currentDay)) {
                return false;
              }
            }

            // Check time range
            if (contact.available_hours_start && contact.available_hours_end) {
              const startTime = contact.available_hours_start.slice(0, 5);
              const endTime = contact.available_hours_end.slice(0, 5);
              
              // Handle overnight shifts
              if (endTime < startTime) {
                if (!(currentTime >= startTime || currentTime <= endTime)) {
                  return false;
                }
              } else {
                if (!(currentTime >= startTime && currentTime <= endTime)) {
                  return false;
                }
              }
            }

            // Check shabbat observer - unavailable from 2h before candles until 2h after havdalah
            if (contact.shabbat_observer && shabbatTimes) {
              const { candleLighting, havdalah } = shabbatTimes;
              const shabbatStart = new Date(candleLighting.getTime() - 2 * 60 * 60 * 1000);
              const shabbatEnd = new Date(havdalah.getTime() + 2 * 60 * 60 * 1000);
              
              // If current time is within Shabbat window, contact is unavailable
              if (now >= shabbatStart && now <= shabbatEnd) {
                return false;
              }
            }

            return true;
          });

        }

        // Always sort by priority_order (or escalation_order as fallback)
        filteredContacts.sort((a, b) => {
          const priorityA = a.priority_order || a.escalation_order || 999;
          const priorityB = b.priority_order || b.escalation_order || 999;
          return priorityA - priorityB;
        });

        // Get rules
        const { data: rules, error: rulesError } = await supabase
          .from('call_category_rules')
          .select('*')
          .eq('call_category_id', category.id)
          .eq('active', true)
          .order('display_order');

        if (rulesError) {
          console.error('Error fetching rules:', rulesError);
        }

        // Get subcategories
        const { data: subcategories, error: subError } = await supabase
          .from('call_category_subcategories')
          .select('*')
          .eq('call_category_id', category.id)
          .eq('active', true)
          .order('display_order');

        if (subError) {
          console.error('Error fetching subcategories:', subError);
        }

        // For each subcategory, get contacts
        const subcategoriesWithContacts = await Promise.all(
          (subcategories || []).map(async (sub) => {
            const { data: subContacts, error: subContactsError } = await supabase
              .from('call_category_subcategory_contacts')
              .select(`
                *,
                contact:on_call_contacts!call_category_subcategory_contacts_contact_id_fkey(*)
              `)
              .eq('subcategory_id', sub.id)
              .eq('active', true)
              .order('escalation_order');

            if (subContactsError) {
              console.error('Error fetching subcategory contacts:', subContactsError);
            }

            return {
              ...sub,
              contacts: subContacts || []
            };
          })
        );

        // Group rules by type
        const groupedRules = {
          rules: rules?.filter(r => r.rule_type === 'rule') || [],
          questions: rules?.filter(r => r.rule_type === 'question') || [],
          special_cases: rules?.filter(r => r.rule_type === 'special_case') || []
        };

        return {
          ...category,
          contacts: filteredContacts,
          rules: groupedRules,
          subcategories: subcategoriesWithContacts || []
        };
      })
    );

    return NextResponse.json({
      success: true,
      categories: categoriesWithDetails
    });

  } catch (error) {
    console.error('Error fetching call categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call categories', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new category
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    // if (!['call_center_manager', 'admin'].includes(authResult.user.role)) {
    //   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    // }

    const body = await request.json();
    const {
      municipality_id,
      name,
      icon,
      description,
      instructions,
      warning,
      auto_message,
      additional_info,
      display_order,
      escalation_type
    } = body;

    if (!municipality_id || !name) {
      return NextResponse.json(
        { error: 'municipality_id and name are required' },
        { status: 400 }
      );
    }

    const resolvedMunicipalityId = await resolveMunicipalityId(municipality_id);

    const { data, error } = await supabase
      .from('call_categories')
      .insert({
        municipality_id: resolvedMunicipalityId,
        name,
        icon,
        description,
        instructions,
        warning,
        auto_message,
        additional_info,
        display_order: display_order || 0,
        escalation_type: escalation_type || 'sequential',
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'קטגוריה נוספה בהצלחה',
      category: data
    });

  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update category
export async function PUT(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    // if (!['call_center_manager', 'admin'].includes(authResult.user.role)) {
    //   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    // }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('call_categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'קטגוריה עודכנה בהצלחה',
      category: data
    });

  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete category
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    // if (!['call_center_manager', 'admin'].includes(authResult.user.role)) {
    //   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    // }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    // Soft delete - set active to false
    const { error } = await supabase
      .from('call_categories')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'קטגוריה נמחקה בהצלחה'
    });

  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category', details: error.message },
      { status: 500 }
    );
  }
}
