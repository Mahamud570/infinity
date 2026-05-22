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

    // Direct CDN URL: Avoid slow server-side fetch and base64 conversion to prevent Vercel 10s timeouts and 4.5MB payload limits!
    const finalImageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&model=${requestedModel}`;
    console.log(`Generated direct CDN URL: ${finalImageUrl}`);

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
