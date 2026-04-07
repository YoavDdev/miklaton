import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// POST - join event via invite token + phone
export async function POST(request) {
  try {
    const body = await request.json();
    const { invite_token, phone, guest_name, action } = body;

    if (!invite_token || !phone) {
      return NextResponse.json({ success: false, error: 'Token and phone required' }, { status: 400 });
    }

    // Find event by token
    const { data: event, error: eventError } = await supabase
      .from('emergency_events')
      .select('*')
      .eq('invite_token', invite_token)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    // Normalize phone - handle +972, dashes, spaces, parentheses
    const normalizePhone = (p) => {
      if (!p) return '';
      let n = p.replace(/[-\s()]/g, ''); // remove dashes, spaces, parentheses
      // Convert +972 to 0
      if (n.startsWith('+972')) n = '0' + n.slice(4);
      if (n.startsWith('972')) n = '0' + n.slice(3);
      return n;
    };
    const normalizedPhone = normalizePhone(phone);

    // Check if already a participant
    const { data: existingParticipant } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', event.id)
      .eq('phone', normalizedPhone)
      .single();

    if (existingParticipant) {
      if (action === 'decline') {
        await supabase
          .from('event_participants')
          .update({ status: 'declined' })
          .eq('id', existingParticipant.id);

        return NextResponse.json({
          success: true,
          data: { ...existingParticipant, status: 'declined' },
          event,
          message: 'declined',
        });
      }

      // Already confirmed - just return
      return NextResponse.json({
        success: true,
        data: existingParticipant,
        event,
        message: 'already_joined',
      });
    }

    // Try to find in contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*, departments(name)')
      .eq('active', true);

    const matchedContact = contacts?.find(c => {
      return normalizePhone(c.phone) === normalizedPhone;
    });

    if (action === 'decline') {
      // Declined but add record
      const participantData = {
        event_id: event.id,
        phone: normalizedPhone,
        display_name: matchedContact?.full_name || guest_name || 'אורח',
        status: 'declined',
      };
      if (matchedContact) {
        participantData.contact_id = matchedContact.id;
        participantData.role = matchedContact.role;
        participantData.department = matchedContact.departments?.name;
      } else {
        participantData.guest_name = guest_name || 'אורח';
        participantData.guest_phone = normalizedPhone;
      }

      const { data, error } = await supabase
        .from('event_participants')
        .insert(participantData)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data, event, message: 'declined' });
    }

    // Step 1: Lookup phone
    if (action === 'lookup') {
      if (matchedContact) {
        return NextResponse.json({
          success: true,
          found: true,
          contact: {
            name: matchedContact.full_name,
            role: matchedContact.role,
            department: matchedContact.departments?.name,
          },
          event: { id: event.id, title: event.title, severity: event.severity, status: event.status },
        });
      } else {
        return NextResponse.json({
          success: true,
          found: false,
          event: { id: event.id, title: event.title, severity: event.severity, status: event.status },
        });
      }
    }

    // Step 2: Confirm join
    if (action === 'confirm') {
      const participantData = {
        event_id: event.id,
        phone: normalizedPhone,
        status: 'confirmed',
      };

      if (matchedContact) {
        participantData.contact_id = matchedContact.id;
        participantData.display_name = matchedContact.full_name;
        participantData.role = matchedContact.role;
        participantData.department = matchedContact.departments?.name;
      } else {
        if (!guest_name) {
          return NextResponse.json({ success: false, error: 'Name required for guests' }, { status: 400 });
        }
        participantData.guest_name = guest_name;
        participantData.guest_phone = normalizedPhone;
        participantData.display_name = guest_name;
      }

      const { data, error } = await supabase
        .from('event_participants')
        .insert(participantData)
        .select()
        .single();

      if (error) throw error;

      // Journal entry
      await supabase.from('event_journal').insert({
        event_id: event.id,
        participant_id: data.id,
        author_name: 'מערכת',
        entry_type: 'system',
        content: `${participantData.display_name} הצטרף/ה לאירוע`,
      });

      return NextResponse.json({ success: true, data, event, message: 'joined' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
