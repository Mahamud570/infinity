import prisma from '@/lib/prisma';
import { Content } from '@google/generative-ai';

const COHERE_MODELS = ['command-r', 'command-r-plus', 'command'];
let currentKeyIndex = 0;

async function log(userId: string, model: string | null, keyIdx: number | null, ms: number, ok: boolean, err: string | null = null) {
  try { await prisma.inferenceLog.create({ data: { userId, modelUsed: model, keyIndexUsed: keyIdx, latencyMs: ms, success: ok, errorMessage: err?.substring(0, 255) ?? null, promptLength: null } }); } catch {}
}

export async function handleCohereChat(userId: string, formattedHistory: Content[], userPrompt: string) {
  const startTime = Date.now();
  const setting = await prisma.systemSetting.findFirst({ where: { userId, key: 'AI_API_KEYS' } });
  let allKeys: any[] = [];
  if (setting?.value) { try { allKeys = JSON.parse(setting.value); } catch {} }
  const keys = allKeys.filter(k => k.provider === 'cohere').map(k => k.key);

  if (keys.length === 0) throw new Error('No Cohere API keys configured. Please add keys in settings.');

  const chatHistory = formattedHistory.map(m => ({ role: m.role === 'model' ? 'CHATBOT' : 'USER', message: m.parts[0]?.text || '' }));
  let lastError = '';

  for (let attempt = 0; attempt < keys.length; attempt++) {
    currentKeyIndex = currentKeyIndex % keys.length;
    const apiKey = keys[currentKeyIndex];

    for (const modelName of COHERE_MODELS) {
      try {
        const res = await fetch('https://api.cohere.ai/v1/chat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName, message: userPrompt, chat_history: chatHistory }),
        });
        if (!res.ok) {
          const errText = await res.text();
          lastError = errText;
          if (res.status === 401 || res.status === 429) break;
          continue;
        }
        const data = await res.json();
        const latency = Date.now() - startTime;
        await log(userId, modelName, currentKeyIndex, latency, true);
        return { text: data.text || '', modelUsed: modelName, keyIndexUsed: currentKeyIndex };
      } catch (error: any) {
        lastError = error.message || 'Unknown';
        await log(userId, modelName, currentKeyIndex, Date.now() - startTime, false, lastError);
      }
    }
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  }
  throw new Error(`All Cohere keys failed. Last error: ${lastError.substring(0, 150)}`);
}
