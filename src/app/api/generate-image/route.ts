import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { prompt, model = 'gemini-3.1-flash-image-preview' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Fetch API keys from DB
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'GEMINI_API_KEYS' } });
    let keys: string[] = [];
    if (setting?.value) {
      try { keys = JSON.parse(setting.value); } catch {}
    }
    if (keys.length === 0) {
      const env = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
      keys = env.split(',').map(k => k.trim()).filter(Boolean);
    }
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No API keys configured.' }, { status: 500 });
    }

    const apiKey = keys[0];
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseModalities: ['Text', 'Image'] },
    });

    // Extract image data from response
    let imageBase64: string | null = null;
    let mimeType = 'image/png';
    let textResponse = '';

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/png';
      }
      if (part.text) textResponse += part.text;
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image was generated. Try a more descriptive prompt.', text: textResponse }, { status: 422 });
    }

    return NextResponse.json({ imageBase64, mimeType, text: textResponse });

  } catch (error: any) {
    console.error('Image generation error:', error);
    let errorMsg = error.message || 'Image generation failed';
    
    try {
      // Try to parse the stringified JSON Google SDK sometimes throws
      const parsed = JSON.parse(error.message);
      if (parsed.error && parsed.error.message) {
        errorMsg = parsed.error.message;
        
        // Check for specific limit: 0 error for Nano Banana
        if (parsed.error.code === 429 && errorMsg.includes('limit: 0')) {
          errorMsg = 'Image generation requires a Google Cloud billing account. Your current free-tier API key has a limit of 0 for Nano Banana models. Please enable billing or use a different key.';
        }
      }
    } catch(e) {}

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
