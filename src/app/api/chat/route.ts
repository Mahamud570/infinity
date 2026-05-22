import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleChatRequest } from '@/lib/gemini';
import { handleOpenAIChat } from '@/lib/openai';
import { handleAnthropicChat } from '@/lib/anthropic';
import { Content } from '@google/generative-ai';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { conversationId, prompt, image, provider = 'gemini' } = await req.json();

    if (!prompt && !image) {
      return NextResponse.json({ error: 'Prompt or image is required' }, { status: 400 });
    }

    const session = await requireAuth();
    const userId = session.userId;

    let convId = conversationId;

    if (!convId) {
      const newConv = await prisma.conversation.create({
        data: {
          userId,
          title: (prompt || 'Image message').substring(0, 40) + ((prompt?.length ?? 0) > 40 ? '...' : ''),
        },
      });
      convId = newConv.id;
    } else {
      const conv = await prisma.conversation.findUnique({ where: { id: convId } });
      if (!conv || conv.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized conversation' }, { status: 403 });
      }
    }

    const previousMessages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'asc' },
    });

    const formattedHistory: Content[] = previousMessages.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: prompt || '(Image)',
      },
    });

    // Fallback chain: try selected provider first, then the others
    const allProviders = ['gemini', 'openai', 'anthropic'];
    const chain = [provider, ...allProviders.filter(p => p !== provider)];

    let aiResponse: any = null;
    let lastError = '';
    let usedProvider = provider;

    for (const p of chain) {
      try {
        if (p === 'openai') {
          aiResponse = await handleOpenAIChat(userId, formattedHistory, prompt || '');
        } else if (p === 'anthropic') {
          aiResponse = await handleAnthropicChat(userId, formattedHistory, prompt || '');
        } else {
          aiResponse = await handleChatRequest(userId, formattedHistory, prompt || '', image);
        }
        usedProvider = p;
        break;
      } catch (err: any) {
        lastError = err.message || 'Unknown error';
        console.warn(`Provider ${p} failed: ${lastError}`);
        // Don't fallback on wrong key — user should fix the key
        if (lastError.includes('401') || lastError.includes('Incorrect API key')) break;
      }
    }

    if (!aiResponse) {
      return NextResponse.json({ error: `All providers failed. Last error: ${lastError}` }, { status: 500 });
    }

    let responseText = aiResponse.text;
    if (usedProvider !== provider) {
      responseText = `*(Auto-switched to **${usedProvider}** because ${provider} was unavailable)*\n\n${responseText}`;
    }

    const aiMessage = await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'model',
        content: responseText,
        modelUsed: aiResponse.modelUsed,
      },
    });

    return NextResponse.json({ message: aiMessage, conversationId: convId });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
