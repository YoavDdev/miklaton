import { NextResponse } from 'next/server';

const LAT = 32.0333;
const LON = 34.8833;

function buildAlerts(hourly, daily) {
  const alerts = [];
  const now = new Date();
  const next24h = hourly.time
    .map((t, i) => ({ time: new Date(t), temp: hourly.temperature_2m[i], wind: hourly.wind_speed_10m[i], gust: hourly.wind_gusts_10m[i], rain: hourly.rain[i], showers: hourly.showers[i], code: hourly.weather_code[i] }))
    .filter(h => h.time >= now && h.time < new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const maxWind = Math.max(...next24h.map(h => h.wind || 0));
  const maxGust = Math.max(...next24h.map(h => h.gust || 0));
  const totalRain = next24h.reduce((sum, h) => sum + (h.rain || 0) + (h.showers || 0), 0);
  const maxTemp = Math.max(...next24h.map(h => h.temp || 0));
  const minTemp = Math.min(...next24h.map(h => h.temp || 0));
  const hasThunder = next24h.some(h => [95, 96, 99].includes(h.code));

  if (maxGust >= 70 || maxWind >= 60) alerts.push({ type: 'wind', severity: 'high', text: `רוחות חזקות: עד ${Math.round(maxGust || maxWind)} קמ"ש` });
  else if (maxGust >= 50 || maxWind >= 40) alerts.push({ type: 'wind', severity: 'medium', text: `רוחות: עד ${Math.round(maxGust || maxWind)} קמ"ש` });

  if (totalRain >= 30) alerts.push({ type: 'rain', severity: 'high', text: `גשם כבד: ~${Math.round(totalRain)} מ"מ ב-24 שעות` });
  else if (totalRain >= 10) alerts.push({ type: 'rain', severity: 'medium', text: `גשם: ~${Math.round(totalRain)} מ"מ ב-24 שעות` });

  if (hasThunder) alerts.push({ type: 'thunder', severity: 'high', text: 'סערת רעמים צפויה' });

  if (maxTemp >= 38) alerts.push({ type: 'heat', severity: 'high', text: `חום גבוה: ${Math.round(maxTemp)}°` });
  else if (maxTemp >= 35) alerts.push({ type: 'heat', severity: 'medium', text: `חום: ${Math.round(maxTemp)}°` });

  if (minTemp <= 3) alerts.push({ type: 'cold', severity: 'medium', text: `קור: ${Math.round(minTemp)}°` });

  const dailyTomorrow = daily ? {
    max: daily.temperature_2m_max[1],
    min: daily.temperature_2m_min[1],
    wind: daily.wind_speed_10m_max[1],
    rain: (daily.precipitation_sum[1] || 0),
    code: daily.weather_code[1],
  } : null;

  return { alerts, next24hSummary: { maxWind, maxGust, totalRain, maxTemp, minTemp }, dailyTomorrow };
}

export async function GET() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,rain,showers&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Asia/Jerusalem&forecast_days=3`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error('Open-Meteo request failed');

    const data = await res.json();
    const { alerts, next24hSummary } = buildAlerts(data.hourly, data.daily);

    const daily = data.daily?.time?.map((t, i) => ({
      date: t,
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
      wind: data.daily.wind_speed_10m_max[i],
      rain: data.daily.precipitation_sum[i] || 0,
      code: data.daily.weather_code[i],
    })) || [];

    return NextResponse.json({
      success: true,
      current: data.current,
      daily,
      alerts,
      summary: next24hSummary,
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
