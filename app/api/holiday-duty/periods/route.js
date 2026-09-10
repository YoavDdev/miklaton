import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { loadPeriods } from '@/lib/holiday-duty-db';

const EDITORS = ['call_center_manager', 'admin'];

export async function GET(request) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const municipalityId = searchParams.get('municipality_id');
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }
  const periods = await loadPeriods(municipalityId);
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  return NextResponse.json({
    success: true,
    periods: periods.filter((p) => new Date(p.ends_at).getTime() >= cutoff),
  });
}
