import { NextResponse } from 'next/server';

// Yehud-Monosson geonameid
const YEHUD_GEONAMEID = '294891';

let cache = null;
let cacheDate = null;

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Return cache if same day
    if (cache && cacheDate === today) {
      return NextResponse.json({ success: true, ...cache });
    }

    const url = `https://www.hebcal.com/shabbat?cfg=json&geonameid=${YEHUD_GEONAMEID}&m=50`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    const candleLighting = data.items?.find(i => i.category === 'candles');
    const havdalah = data.items?.find(i => i.category === 'havdalah');

    if (!candleLighting || !havdalah) {
      return NextResponse.json({ success: false, error: 'No shabbat times found' }, { status: 404 });
    }

    const result = {
      candleLighting: candleLighting.date,   // e.g. "2026-07-03T19:32:00+03:00"
      havdalah: havdalah.date,               // e.g. "2026-07-04T20:40:00+03:00"
    };

    cache = result;
    cacheDate = today;

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Shabbat times error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
