import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await requireAuth();
    
    // Get total requests today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalToday = await prisma.inferenceLog.count({
      where: { 
        userId: session.userId,
        timestamp: { gte: startOfDay }
      }
    });

    // Get recent logs
    const logs = await prisma.inferenceLog.findMany({
      where: { userId: session.userId },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    return NextResponse.json({ totalToday, logs });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
