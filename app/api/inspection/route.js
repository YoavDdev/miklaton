import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const REPORTS_FILE = join(process.cwd(), 'data', 'inspectionReports.json');

function readReports() {
  try {
    const content = readFileSync(REPORTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeReports(reports) {
  writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const zone = searchParams.get('zone');
    const reports = readReports();
    const filtered = zone ? reports.filter(r => r.zone === zone) : reports;
    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error reading inspection reports:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { inspectorName, zone, locationType, locationName, locationAddress, description } = body;

    if (!inspectorName || !zone || !locationType || !locationName || !description) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

    const reports = readReports();

    const newReport = {
      id: `report-${Date.now()}`,
      timestamp: new Date().toISOString(),
      inspectorName,
      zone,
      locationType,
      locationName,
      locationAddress: locationAddress || '',
      description,
      status: 'open'
    };

    reports.unshift(newReport);
    writeReports(reports);

    return NextResponse.json({ success: true, report: newReport });
  } catch (error) {
    console.error('Error saving inspection report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 });
    }

    const reports = readReports();
    const idx = reports.findIndex(r => r.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'דיווח לא נמצא' }, { status: 404 });
    }

    reports[idx].status = status;
    reports[idx].resolvedAt = new Date().toISOString();
    writeReports(reports);

    return NextResponse.json({ success: true, report: reports[idx] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
