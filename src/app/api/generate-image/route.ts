import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Use Pollinations.ai — 100% free, no API key, no billing required
    // Returns a PNG image directly from a URL. We fetch it and convert to base64.
    const encoded = encodeURIComponent(prompt);
    // Use a random seed so each generation is unique
    const seed = Math.floor(Math.random() * 999999);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

    const imageRes = await fetch(url, {
      headers: { 'Accept': 'image/*' },
      // Pollinations can take a few seconds to generate
      signal: AbortSignal.timeout(60000),
    });

    if (!imageRes.ok) {
      return NextResponse.json({ error: 'Image generation failed. Please try a different prompt.' }, { status: 500 });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageRes.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({
      imageBase64,
      mimeType: contentType,
      text: '',
      provider: 'pollinations',
    });

  } catch (error: any) {
    console.error('Image generation error:', error);
    const msg = error?.name === 'TimeoutError'
      ? 'Image generation timed out. Please try again with a simpler prompt.'
      : (error.message || 'Image generation failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
