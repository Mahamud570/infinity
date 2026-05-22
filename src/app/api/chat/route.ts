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

    // Create a new conversation if no ID is provided
    if (!convId) {
      const newConv = await prisma.conversation.create({
        data: {
          userId,
          title: (prompt || 'Image message').substring(0, 40) + ((prompt?.length ?? 0) > 40 ? '...' : ''),
        },
      });
      convId = newConv.id;
    } else {
      // Verify conversation belongs to user
      const conv = await prisma.conversation.findUnique({ where: { id: convId } });
      if (!conv || conv.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized conversation' }, { status: 403 });
      }
    }

    // Fetch existing messages for this conversation
    const previousMessages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'asc' },
    });

    // Format for Gemini
    const formattedHistory: Content[] = previousMessages.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Save the user's new message to DB
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: prompt || '(Image)',
      },
    });

    let aiResponse;
    if (provider === 'openai') {
      aiResponse = await handleOpenAIChat(userId, formattedHistory, prompt || '');
    } else if (provider === 'anthropic') {
      aiResponse = await handleAnthropicChat(userId, formattedHistory, prompt || '');
    } else {
      aiResponse = await handleChatRequest(userId, formattedHistory, prompt || '', image);
    }

    // Save the AI's response to DB
    const aiMessage = await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'model',
        content: aiResponse.text,
        modelUsed: aiResponse.modelUsed,
      },
    });

    return NextResponse.json({
      message: aiMessage,
      conversationId: convId,
      keyIndexUsed: aiResponse.keyIndexUsed
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
