import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Pollinations.ai — 100% free, no API key, no billing required.
    // We return a direct URL — the browser fetches the image itself, avoiding server timeouts.
    const encoded = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true&model=flux`;

    return NextResponse.json({ imageUrl, provider: 'pollinations' });

  } catch (error: any) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: error.message || 'Image generation failed' }, { status: 500 });
  }
}
