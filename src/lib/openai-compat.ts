/**
 * Generic handler for OpenAI-compatible APIs (Groq, OpenRouter, Mistral, etc.)
 * All these providers support the same /v1/chat/completions endpoint.
 */
import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { Content } from '@google/generative-ai';

interface CompatConfig {
  providerKey: string;   // key in AI_API_KEYS
  baseURL: string;
  models: string[];
  defaultHeaders?: Record<string, string>;
}

async function getKeys(userId: string, providerKey: string): Promise<string[]> {
  const setting = await prisma.systemSetting.findFirst({ where: { userId, key: 'AI_API_KEYS' } });
  let allKeys: any[] = [];
  if (setting?.value) { try { allKeys = JSON.parse(setting.value); } catch {} }
  return allKeys.filter(k => k.provider === providerKey).map(k => k.key);
}

async function log(userId: string, model: string | null, keyIdx: number | null, ms: number, ok: boolean, err: string | null = null) {
  try {
    await prisma.inferenceLog.create({ data: { userId, modelUsed: model, keyIndexUsed: keyIdx, latencyMs: ms, success: ok, errorMessage: err?.substring(0, 255) ?? null, promptLength: null } });
  } catch {}
}

let keyIndexes: Record<string, number> = {};

export async function handleCompatChat(
  userId: string,
  formattedHistory: Content[],
  userPrompt: string,
  config: CompatConfig,
  image?: { base64: string; mimeType: string } | null
) {
  const startTime = Date.now();
  const keys = await getKeys(userId, config.providerKey);

  if (keys.length === 0) {
    throw new Error(`No ${config.providerKey} API keys configured. Please add keys in settings.`);
  }

  const messages: any[] = formattedHistory.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts[0]?.text || '' }));

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
    messages.push({ role: 'user', content: contentArray });
  } else {
    if (userPrompt) messages.push({ role: 'user', content: userPrompt });
  }

  let idx = keyIndexes[config.providerKey] ?? 0;
  let lastError = '';

  for (let attempt = 0; attempt < keys.length; attempt++) {
    idx = idx % keys.length;
    const client = new OpenAI({ apiKey: keys[idx], baseURL: config.baseURL, defaultHeaders: config.defaultHeaders });

    for (const modelName of config.models) {
      try {
        const response = await client.chat.completions.create({ model: modelName, messages });
        const latency = Date.now() - startTime;
        await log(userId, modelName, idx, latency, true);
        keyIndexes[config.providerKey] = idx;
        return { text: response.choices[0].message.content || '', modelUsed: modelName, keyIndexUsed: idx };
      } catch (error: any) {
        lastError = error.message || 'Unknown error';
        console.warn(`[${config.providerKey}] key[${idx}] model[${modelName}] failed: ${error.status} ${lastError.substring(0, 60)}`);
        await log(userId, modelName, idx, Date.now() - startTime, false, lastError);
        if (error.status === 401 || error.status === 429 || lastError.includes('quota') || lastError.includes('billing')) break;
      }
    }
    idx = (idx + 1) % keys.length;
  }

  keyIndexes[config.providerKey] = idx;
  throw new Error(`All ${config.providerKey} keys failed. Last error: ${lastError.substring(0, 150)}`);
}

// ─── Provider-specific exports ────────────────────────────────────────────────

export async function handleGroqChat(userId: string, history: Content[], prompt: string, image?: { base64: string; mimeType: string } | null) {
  return handleCompatChat(userId, history, prompt, {
    providerKey: 'groq',
    baseURL: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  }, image);
}

export async function handleOpenRouterChat(userId: string, history: Content[], prompt: string, image?: { base64: string; mimeType: string } | null) {
  return handleCompatChat(userId, history, prompt, {
    providerKey: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['meta-llama/llama-3.2-3b-instruct:free', 'google/gemma-3-27b-it:free', 'mistralai/mistral-7b-instruct:free'],
    defaultHeaders: { 'HTTP-Referer': 'https://infinite-ai-hub.vercel.app', 'X-Title': 'Infinite AI Hub' },
  }, image);
}

export async function handleMistralChat(userId: string, history: Content[], prompt: string, image?: { base64: string; mimeType: string } | null) {
  return handleCompatChat(userId, history, prompt, {
    providerKey: 'mistral',
    baseURL: 'https://api.mistral.ai/v1',
    models: ['mistral-small-latest', 'open-mistral-7b', 'mistral-medium-latest'],
  }, image);
}
