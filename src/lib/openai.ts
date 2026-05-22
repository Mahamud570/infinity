import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { Content } from '@google/generative-ai';

let currentKeyIndex = 0;

// Model fallback chain: cheapest/fastest first, more capable as fallback
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4o'];

export async function handleOpenAIChat(
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

  const openAIKeys = allKeys.filter(k => k.provider === 'openai').map(k => k.key);

  if (openAIKeys.length === 0) {
    throw new Error('No OpenAI API keys configured. Please add keys in settings.');
  }

  const openAIMessages: any[] = formattedHistory.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.parts[0]?.text || ''
  }));

  // Handle multimodal vision formatting if image is attached
  if (image && image.base64) {
    const contentArray: any[] = [];
    if (userPrompt) {
      contentArray.push({ type: 'text', text: userPrompt });
    }
    const mime = image.mimeType || 'image/jpeg';
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: `data:${mime};base64,${image.base64}`
      }
    });
    openAIMessages.push({ role: 'user', content: contentArray });
  } else {
    if (userPrompt) openAIMessages.push({ role: 'user', content: userPrompt });
  }

  // Count prompt length (approximate)
  const promptLength = openAIMessages.reduce((acc, curr) => {
    if (typeof curr.content === 'string') return acc + curr.content.length;
    if (Array.isArray(curr.content)) {
      return acc + curr.content.reduce((sum: number, part: any) => sum + (part.text ? part.text.length : 0), 0);
    }
    return acc;
  }, 0);

  let lastErrorMessage = '';

  for (let attempt = 0; attempt < openAIKeys.length; attempt++) {
    currentKeyIndex = currentKeyIndex % openAIKeys.length;
    const apiKey = openAIKeys[currentKeyIndex];
    const openai = new OpenAI({ apiKey });

    for (const modelName of OPENAI_MODELS) {
      try {
        const response = await openai.chat.completions.create({
          model: modelName,
          messages: openAIMessages,
        });

        const latency = Date.now() - startTime;
        await logInference(userId, modelName, currentKeyIndex, latency, true, null, promptLength);

        return {
          text: response.choices[0].message.content || '',
          modelUsed: modelName,
          keyIndexUsed: currentKeyIndex
        };

      } catch (error: any) {
        lastErrorMessage = error.message || 'Unknown error';
        console.warn(`OpenAI Key[${currentKeyIndex}] model[${modelName}] failed: ${error.status} ${lastErrorMessage.substring(0, 80)}`);
        await logInference(userId, modelName, currentKeyIndex, Date.now() - startTime, false, lastErrorMessage.substring(0, 255), promptLength);

        // On quota/billing/auth error, rotate key (don't try other models with same bad key)
        if (error.status === 429 || error.status === 401 || lastErrorMessage.includes('quota') || lastErrorMessage.includes('billing')) {
          break;
        }
        // On model-not-found or other transient errors, try next model
      }
    }

    currentKeyIndex = (currentKeyIndex + 1) % openAIKeys.length;
  }

  throw new Error(`All OpenAI keys and models failed. Last error: ${lastErrorMessage.substring(0, 150)}`);
}

async function logInference(userId: string, modelUsed: string | null, keyIndexUsed: number | null, latencyMs: number, success: boolean, errorMessage: string | null = null, promptLength: number | null = null) {
  try {
    await prisma.inferenceLog.create({
      data: { userId, modelUsed, keyIndexUsed, latencyMs, success, errorMessage: errorMessage ? errorMessage.substring(0, 255) : null, promptLength },
    });
  } catch (err) {}
}
