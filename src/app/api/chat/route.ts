import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleChatRequest } from '@/lib/gemini';
import { Content } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { conversationId, prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let convId = conversationId;

    // Create a new conversation if no ID is provided
    if (!convId) {
      const newConv = await prisma.conversation.create({
        data: {
          title: prompt.substring(0, 40) + (prompt.length > 40 ? '...' : ''),
        },
      });
      convId = newConv.id;
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
        content: prompt,
      },
    });

    // Call the Gemini Rotator
    const geminiResponse = await handleChatRequest(formattedHistory, prompt);

    // Save the AI's response to DB
    const aiMessage = await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'model',
        content: geminiResponse.text,
        modelUsed: geminiResponse.modelUsed,
      },
    });

    return NextResponse.json({
      message: aiMessage,
      conversationId: convId,
      keyIndexUsed: geminiResponse.keyIndexUsed
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
