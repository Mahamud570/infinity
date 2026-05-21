import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Simple password protection for settings
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'infinite';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'GEMINI_API_KEYS' },
    });

    const keys = setting ? JSON.parse(setting.value) : [];
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Settings GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keys } = await req.json();
    if (!Array.isArray(keys)) {
      return NextResponse.json({ error: 'Keys must be an array' }, { status: 400 });
    }

    await prisma.systemSetting.upsert({
      where: { key: 'GEMINI_API_KEYS' },
      update: { value: JSON.stringify(keys) },
      create: { key: 'GEMINI_API_KEYS', value: JSON.stringify(keys) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
