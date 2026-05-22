import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { Content } from '@google/generative-ai';

let currentKeyIndex = 0;

// Model fallback chain: fastest/cheapest first
const ANTHROPIC_MODELS = ['claude-3-haiku-20240307', 'claude-3-5-sonnet-latest', 'claude-3-opus-20240229'];

export async function handleAnthropicChat(
  userId: string,
  formattedHistory: Content[],
  userPrompt: string,
  image?: { base64: string; mimeType: string } | null
) {
  const startTime = Date.now();
  
  const setting = await prisma.systemSetting.findFirst({
    where: { userId, key: 'AI_API_KEYS' },
  });
  
  let allKeys: any[] = [];
  if (setting && setting.value) {
    try { allKeys = JSON.parse(setting.value); } catch (e) {}
  }

  const anthropicKeys = allKeys.filter(k => k.provider === 'anthropic').map(k => k.key);

  if (anthropicKeys.length === 0) {
    throw new Error('No Anthropic API keys configured. Please add keys in settings.');
  }

  const anthropicMessages: any[] = formattedHistory.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.parts[0]?.text || ''
  }));

  // Handle Claude vision multimodal base64 image formatting
  if (image && image.base64) {
    const contentArray: any[] = [];
    if (userPrompt) {
      contentArray.push({ type: 'text', text: userPrompt });
    }
    const mime = image.mimeType || 'image/jpeg';
    contentArray.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mime,
        data: image.base64
      }
    });
    anthropicMessages.push({ role: 'user', content: contentArray });
  } else {
    if (userPrompt) anthropicMessages.push({ role: 'user', content: userPrompt });
  }

  // Count prompt length (approximate)
  const promptLength = anthropicMessages.reduce((acc, curr) => {
    if (typeof curr.content === 'string') return acc + curr.content.length;
    if (Array.isArray(curr.content)) {
      return acc + curr.content.reduce((sum: number, part: any) => sum + (part.text ? part.text.length : 0), 0);
    }
    return acc;
  }, 0);

  let lastErrorMessage = '';

  for (let attempt = 0; attempt < anthropicKeys.length; attempt++) {
    currentKeyIndex = currentKeyIndex % anthropicKeys.length;
    const apiKey = anthropicKeys[currentKeyIndex];
    const anthropic = new Anthropic({ apiKey });

    for (const modelName of ANTHROPIC_MODELS) {
      try {
        const response = await anthropic.messages.create({
          model: modelName,
          max_tokens: 4096,
          messages: anthropicMessages,
        });

        const latency = Date.now() - startTime;
        await logInference(userId, modelName, currentKeyIndex, latency, true, null, promptLength);

        const content = response.content[0].type === 'text' ? response.content[0].text : '';
        return { text: content, modelUsed: modelName, keyIndexUsed: currentKeyIndex };

      } catch (error: any) {
        lastErrorMessage = error.message || 'Unknown error';
        console.warn(`Anthropic Key[${currentKeyIndex}] model[${modelName}] failed: ${error.status} ${lastErrorMessage.substring(0, 80)}`);
        await logInference(userId, modelName, currentKeyIndex, Date.now() - startTime, false, lastErrorMessage.substring(0, 255), promptLength);

        // On credit/billing/auth error, rotate key
        if (error.status === 429 || error.status === 401 || lastErrorMessage.includes('credit') || lastErrorMessage.includes('billing')) {
          break;
        }
        // On overload/model error, try next model
      }
    }

    currentKeyIndex = (currentKeyIndex + 1) % anthropicKeys.length;
  }

  throw new Error(`All Anthropic keys and models failed. Last error: ${lastErrorMessage.substring(0, 150)}`);
}

async function logInference(userId: string, modelUsed: string | null, keyIndexUsed: number | null, latencyMs: number, success: boolean, errorMessage: string | null = null, promptLength: number | null = null) {
  try {
    await prisma.inferenceLog.create({
      data: { userId, modelUsed, keyIndexUsed, latencyMs, success, errorMessage: errorMessage ? errorMessage.substring(0, 255) : null, promptLength },
    });
  } catch (err) {}
}
