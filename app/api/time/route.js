import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    timestamp: Date.now(),
    timezone: 'Asia/Jerusalem',
    iso: new Date().toISOString()
  });
}
