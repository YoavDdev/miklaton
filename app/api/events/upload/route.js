import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const eventId = formData.get('event_id');

    if (!file || !eventId) {
      return NextResponse.json({ success: false, error: 'File and event_id required' }, { status: 400 });
    }

    const access = await requireEventAccess(request, String(eventId));
    if (access.error) return access.error;
    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Only images allowed' }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Image too large (max 10MB)' }, { status: 400 });
    }

    // Sanitize path parts (prevent path traversal)
    const safeEventId = String(eventId).replace(/[^a-zA-Z0-9-]/g, '');
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
    const rawExt = (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const ext = allowedExts.includes(rawExt) ? rawExt : 'jpg';
    if (!safeEventId) {
      return NextResponse.json({ success: false, error: 'Invalid event_id' }, { status: 400 });
    }
    const fileName = `${safeEventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await supabase.storage
      .from('event-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
