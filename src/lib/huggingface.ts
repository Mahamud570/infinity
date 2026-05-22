import prisma from '@/lib/prisma';
import { Content } from '@google/generative-ai';

// Free HuggingFace inference models (text generation)
const HF_MODELS = ['mistralai/Mistral-7B-Instruct-v0.3', 'microsoft/DialoGPT-large', 'HuggingFaceH4/zephyr-7b-beta'];
let currentKeyIndex = 0;

async function log(userId: string, model: string | null, keyIdx: number | null, ms: number, ok: boolean, err: string | null = null) {
  try { await prisma.inferenceLog.create({ data: { userId, modelUsed: model, keyIndexUsed: keyIdx, latencyMs: ms, success: ok, errorMessage: err?.substring(0, 255) ?? null, promptLength: null } }); } catch {}
}

export async function handleHuggingFaceChat(userId: string, formattedHistory: Content[], userPrompt: string) {
  const startTime = Date.now();
  const setting = await prisma.systemSetting.findFirst({ where: { userId, key: 'AI_API_KEYS' } });
  let allKeys: any[] = [];
  if (setting?.value) { try { allKeys = JSON.parse(setting.value); } catch {} }
  const keys = allKeys.filter(k => k.provider === 'huggingface').map(k => k.key);

  if (keys.length === 0) throw new Error('No HuggingFace API keys configured. Please add keys in settings.');

  // Build conversation string
  const conversationParts = formattedHistory.map(m => `${m.role === 'model' ? 'Assistant' : 'User'}: ${m.parts[0]?.text || ''}`);
  conversationParts.push(`User: ${userPrompt}`);
  conversationParts.push('Assistant:');
  const inputs = conversationParts.join('\n');

  let lastError = '';

  for (let attempt = 0; attempt < keys.length; attempt++) {
    currentKeyIndex = currentKeyIndex % keys.length;
    const apiKey = keys[currentKeyIndex];

    for (const modelName of HF_MODELS) {
      try {
        const res = await fetch(`https://api-inference.huggingface.co/models/${modelName}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs, parameters: { max_new_tokens: 512, return_full_text: false } }),
        });
        if (!res.ok) {
          lastError = await res.text();
          if (res.status === 401 || res.status === 403) break;
          continue;
        }
        const data = await res.json();
        const text = Array.isArray(data) ? (data[0]?.generated_text || '') : (data?.generated_text || '');
        const latency = Date.now() - startTime;
        await log(userId, modelName, currentKeyIndex, latency, true);
        return { text: text.trim(), modelUsed: modelName, keyIndexUsed: currentKeyIndex };
      } catch (error: any) {
        lastError = error.message || 'Unknown';
        await log(userId, modelName, currentKeyIndex, Date.now() - startTime, false, lastError);
      }
    }
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  }
  throw new Error(`All HuggingFace keys failed. Last error: ${lastError.substring(0, 150)}`);
}
