#!/usr/bin/env node
/**
 * זריעה חד-פעמית של תקופות חג ל-holiday_periods.
 * הרצה: node scripts/seed-holidays.js 5787 5788
 *
 * למה לזרוע ולא לקרוא ל-Hebcal בזמן אמת: המוקד עובד גם כשאין אינטרנט החוצה,
 * וזיהוי החג מכריע מי מוצג למוקדן. תאריכי חג אינם משתנים.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) {
      const k = line.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  }
}

async function main() {
  loadEnv();
  const years = process.argv.slice(2).length ? process.argv.slice(2) : ['5787', '5788'];
  const municipalityId = process.env.NEXT_PUBLIC_MUNICIPALITY_ID;
  if (!municipalityId) throw new Error('NEXT_PUBLIC_MUNICIPALITY_ID is not set');

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { buildPeriodsFromHebcal } = await import('../lib/holidays.js');

  for (const year of years) {
    const url =
      `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off` +
      `&year=${year}&yt=H&c=on&geonameid=293397&M=on&s=off&i=on`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Hebcal ${year} returned ${res.status}`);
    const { items } = await res.json();

    const rows = buildPeriodsFromHebcal(items).map((p) => ({
      municipality_id: municipalityId,
      name: p.name,
      slug: `${p.days[0]}-${p.name}`.replace(/\s+/g, '-'),
      starts_at: p.starts_at,
      ends_at: p.ends_at,
    }));

    const { error } = await supabase
      .from('holiday_periods')
      .upsert(rows, { onConflict: 'municipality_id,slug', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    console.log(`${year}: נזרעו ${rows.length} תקופות`);
    for (const r of rows) console.log(`  ${r.name}  ${r.starts_at} → ${r.ends_at}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
