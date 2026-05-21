import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'infinite';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logs = await prisma.inferenceLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100, // Limit to recent 100
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Logs GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
