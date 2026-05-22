import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { Content } from '@google/generative-ai';

let currentKeyIndex = 0;

export async function handleAnthropicChat(
  userId: string,
  formattedHistory: Content[],
  userPrompt: string
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
    await logInference(userId, null, null, Date.now() - startTime, false, "No Anthropic API keys configured");
    throw new Error("No Anthropic API keys configured. Please add keys in settings.");
  }

  // Convert Gemini Content[] to Anthropic format
  const anthropicMessages: any[] = formattedHistory.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.parts[0]?.text || ''
  }));
  if (userPrompt) anthropicMessages.push({ role: 'user', content: userPrompt });

  const promptLength = anthropicMessages.reduce((acc, curr) => acc + curr.content.length, 0);
  let lastErrorMessage = "";

  for (let attempt = 0; attempt < anthropicKeys.length; attempt++) {
    try {
      currentKeyIndex = currentKeyIndex % anthropicKeys.length;
      const apiKey = anthropicKeys[currentKeyIndex];
      const anthropic = new Anthropic({ apiKey });
      const modelName = "claude-3-5-sonnet-latest";

      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 4096,
        messages: anthropicMessages,
      });

      const latency = Date.now() - startTime;
      await logInference(userId, modelName, currentKeyIndex, latency, true, null, promptLength);
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '';

      return { 
        text: content, 
        modelUsed: modelName, 
        keyIndexUsed: currentKeyIndex 
      };

    } catch (error: any) {
      console.error(`Anthropic Error with key index ${currentKeyIndex}:`, error.message);
      
      if (error.status === 429 || error.message?.includes('credit') || error.message?.includes('rate limit')) {
        console.warn(`Anthropic Key Index ${currentKeyIndex} limited. Rotating to next key...`);
        lastErrorMessage = error.message;
        await logInference(userId, "claude-3-5-sonnet", currentKeyIndex, Date.now() - startTime, false, "Rate limited or Quota exceeded", promptLength);
        currentKeyIndex = (currentKeyIndex + 1) % anthropicKeys.length;
        continue;
      }
      
      await logInference(userId, "claude-3-5-sonnet", currentKeyIndex, Date.now() - startTime, false, error.message, promptLength);
      throw error;
    }
  }
  
  if (lastErrorMessage.includes('credit') || lastErrorMessage.includes('429')) {
    throw new Error(`All Anthropic keys failed due to billing or quota limits (429). Error: ${lastErrorMessage.substring(0, 100)}...`);
  }
  throw new Error("All Anthropic keys and models in the pool are temporarily exhausted.");
}

async function logInference(userId: string, modelUsed: string | null, keyIndexUsed: number | null, latencyMs: number, success: boolean, errorMessage: string | null = null, promptLength: number | null = null) {
  try {
    await prisma.inferenceLog.create({
      data: {
        userId,
        modelUsed,
        keyIndexUsed,
        latencyMs,
        success,
        errorMessage: errorMessage ? errorMessage.substring(0, 255) : null,
        promptLength,
      }
    });
  } catch (err) {}
}
