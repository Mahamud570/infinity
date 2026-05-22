import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const maxDuration = 60; // Allow up to 60s for image generation

const IMAGE_MODELS = ['flux', 'turbo', 'unity'];

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = session.userId;

    const { prompt, model, conversationId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 1. Handle Conversation creation/verification
    let convId = conversationId;
    if (!convId) {
      const newConv = await prisma.conversation.create({
        data: {
          userId,
          title: `🎨 Generate: ${prompt}`.substring(0, 40) + (prompt.length > 30 ? '...' : ''),
        },
      });
      convId = newConv.id;
    } else {
      const conv = await prisma.conversation.findUnique({ where: { id: convId } });
      if (!conv || conv.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized conversation' }, { status: 403 });
      }
    }

    // 2. Save the User Prompt message to database
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: `🎨 Generate: ${prompt}`,
      },
    });

    const encoded = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 999999);
    
    // Choose model query param based on selected model or fallback list
    const requestedModel = model && model.includes('hd') ? 'flux' : 'turbo';
    const modelsToTry = [requestedModel, ...IMAGE_MODELS.filter(m => m !== requestedModel)];

    let lastError = '';
    let finalImageUrl = '';

    for (const currentModel of modelsToTry) {
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&model=${currentModel}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout per model attempt

      try {
        console.log(`Attempting image generation with model: ${currentModel}`);
        const imageRes = await fetch(url, {
          signal: controller.signal,
          headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'sec-ch-ua': '"Not A(BA-BUM";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
          },
        });
        clearTimeout(timeoutId);

        if (imageRes.ok) {
          const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await imageRes.arrayBuffer();
          
          if (arrayBuffer.byteLength > 1000) { // Verify it's a real image and not an empty error response
            const imageBase64 = Buffer.from(arrayBuffer).toString('base64');
            finalImageUrl = `data:${contentType};base64,${imageBase64}`;
            break;
          }
        }
        
        lastError = `Status ${imageRes.status}`;
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        lastError = fetchErr.message || 'Timeout/Network error';
        console.warn(`Image generation failed for model ${currentModel}: ${lastError}`);
      }
    }

    // Direct URL Fallback: if all server-side proxy attempts fail, return a direct pollinations URL
    if (!finalImageUrl) {
      finalImageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true`;
      console.log(`All base64 proxy attempts failed. Falling back to direct URL: ${finalImageUrl}`);
    }

    // 3. Save the Model response message with imageUrl
    const modelMessage = await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'model',
        content: '✨ Here is your generated image:',
        modelUsed: 'pollinations',
        imageUrl: finalImageUrl,
      },
    });

    return NextResponse.json({ 
      imageUrl: finalImageUrl, 
      conversationId: convId,
      message: modelMessage
    });

  } catch (error: any) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: error.message || 'Image generation failed' }, { status: 500 });
  }
}
