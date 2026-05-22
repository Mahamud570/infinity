import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await requireAuth();
    
    const setting = await prisma.systemSetting.findFirst({
      where: { userId: session.userId, key: 'AI_API_KEYS' },
    });
    let keys: any[] = [];
    if (setting && setting.value) {
      try {
        keys = JSON.parse(setting.value);
      } catch (e) {}
    }
    return NextResponse.json({ keys });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const { keys } = await req.json();

    if (!Array.isArray(keys)) {
      return NextResponse.json({ error: 'Keys must be an array' }, { status: 400 });
    }

    const setting = await prisma.systemSetting.findFirst({
      where: { userId: session.userId, key: 'AI_API_KEYS' },
    });

    if (setting) {
       await prisma.systemSetting.update({
          where: { id: setting.id },
          data: { value: JSON.stringify(keys) }
       });
    } else {
       await prisma.systemSetting.create({
          data: {
             userId: session.userId,
             key: 'AI_API_KEYS',
             value: JSON.stringify(keys)
          }
       });
    }

    return NextResponse.json({ keys });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
