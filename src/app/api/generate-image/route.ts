import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const maxDuration = 60; // Allow up to 60s for image generation

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const encoded = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 999999);
    // Use the Pollinations turbo model - fastest and free
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&model=turbo`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      const imageRes = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      clearTimeout(timeoutId);

      if (!imageRes.ok) {
        return NextResponse.json({ error: 'Image generation failed. Try a different prompt.' }, { status: 500 });
      }

      const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imageRes.arrayBuffer();
      const imageBase64 = Buffer.from(arrayBuffer).toString('base64');

      return NextResponse.json({ imageBase64, mimeType: contentType });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr?.name === 'AbortError') {
        return NextResponse.json({ error: 'Image generation timed out. Please try again.' }, { status: 504 });
      }
      throw fetchErr;
    }
  } catch (error: any) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: error.message || 'Image generation failed' }, { status: 500 });
  }
}
