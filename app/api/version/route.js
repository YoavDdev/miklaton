import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'version.json');
    const content = fs.readFileSync(filePath, 'utf8');
    const version = JSON.parse(content);
    return NextResponse.json({ success: true, ...version });
  } catch (error) {
    return NextResponse.json({ success: false, hash: null, builtAt: null }, { status: 500 });
  }
}
