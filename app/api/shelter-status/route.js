import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const statusFilePath = path.join(process.cwd(), 'data', 'shelterStatus.json');

export async function GET() {
  try {
    const data = fs.readFileSync(statusFilePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ statuses: {} }, { status: 200 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { shelterNumber, isOpen, updatedBy } = body;
    
    let statusData = { statuses: {} };
    
    try {
      const existingData = fs.readFileSync(statusFilePath, 'utf-8');
      statusData = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist, use default
    }
    
    statusData.statuses[shelterNumber] = isOpen;
    statusData.lastUpdated = new Date().toISOString();
    statusData.updatedBy = updatedBy || 'מוקדן';
    
    fs.writeFileSync(statusFilePath, JSON.stringify(statusData, null, 2));
    
    return NextResponse.json({ success: true, data: statusData });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
