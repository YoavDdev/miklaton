import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  buildPeriodsFromHebcal,
  findActivePeriod,
  findUpcomingPeriod,
  isHolidayNow,
  effectiveDayOfWeek,
} from '@/lib/holidays';

const fixture = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/hebcal-5787.json'), 'utf8')
);

describe('buildPeriodsFromHebcal', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('מוצא שבע תקופות חג בתשפ״ז', () => {
    expect(periods).toHaveLength(7);
  });

  it('מאחד את ראש השנה לרצף אחד של שלושה ימים', () => {
    expect(periods[0]).toMatchObject({
      name: 'ראש השנה 5787',
      starts_at: '2026-09-11T18:32:00+03:00',
      ends_at: '2026-09-13T19:26:00+03:00',
    });
    expect(periods[0].days).toEqual(['2026-09-12', '2026-09-13']);
  });

  it('לא בולע שבתות רגילות כתקופות חג', () => {
    // 18-19.9.2026 היא שבת רגילה עם הדלקה והבדלה, ואינה חג
    expect(periods.some((p) => p.starts_at.startsWith('2026-09-18'))).toBe(false);
  });

  it('מותח את שבועות עד מוצאי שבת כשהחג צמוד לשבת', () => {
    const shavuot = periods.find((p) => p.name === 'שבועות');
    expect(shavuot.starts_at).toBe('2027-06-10T19:26:00+03:00');
    expect(shavuot.ends_at).toBe('2027-06-12T20:30:00+03:00');
  });

  it('אינו קורס על רשימה ריקה', () => {
    expect(buildPeriodsFromHebcal([])).toEqual([]);
  });
});

describe('findActivePeriod', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('מזהה את ראש השנה בתוך החג', () => {
    const now = new Date('2026-09-12T10:00:00+03:00');
    expect(findActivePeriod(periods, now).name).toBe('ראש השנה 5787');
  });

  it('מזהה את יום ראשון 13.9 כחג — זה המקרה ששובר את לוח השבוע', () => {
    const now = new Date('2026-09-13T09:00:00+03:00');
    expect(findActivePeriod(periods, now).name).toBe('ראש השנה 5787');
  });

  it('דקה לפני ההדלקה עדיין אינו חג', () => {
    expect(findActivePeriod(periods, new Date('2026-09-11T18:31:00+03:00'))).toBeNull();
  });

  it('בדיוק ברגע ההדלקה כבר חג', () => {
    expect(findActivePeriod(periods, new Date('2026-09-11T18:32:00+03:00'))).not.toBeNull();
  });

  it('אחרי ההבדלה אינו חג', () => {
    expect(findActivePeriod(periods, new Date('2026-09-13T19:27:00+03:00'))).toBeNull();
  });
});

describe('effectiveDayOfWeek', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('מחזיר 6 ביום ראשון שהוא חג', () => {
    expect(effectiveDayOfWeek(periods, new Date('2026-09-13T09:00:00+03:00'))).toBe(6);
  });

  it('מחזיר 0 ביום ראשון רגיל', () => {
    expect(effectiveDayOfWeek(periods, new Date('2026-09-06T09:00:00+03:00'))).toBe(0);
  });

  it('מחזיר 6 בשבת רגילה', () => {
    expect(effectiveDayOfWeek(periods, new Date('2026-09-19T09:00:00+03:00'))).toBe(6);
  });

  it('מחשב לפי אזור זמן ישראל ולא לפי UTC', () => {
    // 13.9 בשעה 22:30 UTC הוא כבר 14.9 בישראל — יום שני, ואחרי צאת החג
    expect(effectiveDayOfWeek(periods, new Date('2026-09-13T22:30:00Z'))).toBe(1);
  });
});

describe('findUpcomingPeriod', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('מחזיר את ראש השנה 24 שעות לפניו', () => {
    const now = new Date('2026-09-10T18:00:00+03:00');
    expect(findUpcomingPeriod(periods, now, 48).name).toBe('ראש השנה 5787');
  });

  it('מחזיר null כשהחג רחוק מהחלון', () => {
    expect(findUpcomingPeriod(periods, new Date('2026-09-01T09:00:00+03:00'), 48)).toBeNull();
  });

  it('אינו מחזיר תקופה שכבר התחילה', () => {
    expect(findUpcomingPeriod(periods, new Date('2026-09-12T09:00:00+03:00'), 48)).toBeNull();
  });
});

describe('isHolidayNow', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('אמת בתוך החג, שקר מחוצה לו', () => {
    expect(isHolidayNow(periods, new Date('2026-09-21T12:00:00+03:00'))).toBe(true);
    expect(isHolidayNow(periods, new Date('2026-09-23T12:00:00+03:00'))).toBe(false);
  });

  it('אינו קורס על רשימה ריקה', () => {
    expect(isHolidayNow([], new Date())).toBe(false);
  });
});
