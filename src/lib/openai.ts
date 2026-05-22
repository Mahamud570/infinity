import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { Content } from '@google/generative-ai';

let currentKeyIndex = 0;

export async function handleOpenAIChat(
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

  const openAIKeys = allKeys.filter(k => k.provider === 'openai').map(k => k.key);

  if (openAIKeys.length === 0) {
    await logInference(userId, null, null, Date.now() - startTime, false, "No OpenAI API keys configured");
    throw new Error("No OpenAI API keys configured. Please add keys in settings.");
  }

  // Convert Gemini Content[] to OpenAI format
  const openAIMessages: any[] = formattedHistory.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.parts[0]?.text || ''
  }));
  if (userPrompt) openAIMessages.push({ role: 'user', content: userPrompt });

  const promptLength = openAIMessages.reduce((acc, curr) => acc + curr.content.length, 0);
  let lastErrorMessage = "";

  for (let attempt = 0; attempt < openAIKeys.length; attempt++) {
    try {
      currentKeyIndex = currentKeyIndex % openAIKeys.length;
      const apiKey = openAIKeys[currentKeyIndex];
      const openai = new OpenAI({ apiKey });
      const modelName = "gpt-4o-mini";

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
      console.error(`OpenAI Error with key index ${currentKeyIndex}:`, error.message);
      
      if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit')) {
        console.warn(`OpenAI Key Index ${currentKeyIndex} limited. Rotating to next key...`);
        lastErrorMessage = error.message;
        await logInference(userId, "gpt-4o-mini", currentKeyIndex, Date.now() - startTime, false, "Rate limited or Quota exceeded", promptLength);
        currentKeyIndex = (currentKeyIndex + 1) % openAIKeys.length;
        continue;
      }
      
      await logInference(userId, "gpt-4o-mini", currentKeyIndex, Date.now() - startTime, false, error.message, promptLength);
      throw error;
    }
  }
  
  if (lastErrorMessage.includes('quota') || lastErrorMessage.includes('429')) {
    throw new Error(`All OpenAI keys failed due to billing or quota limits (429). Google error: ${lastErrorMessage.substring(0, 100)}...`);
  }
  throw new Error("All OpenAI keys and models in the pool are temporarily exhausted.");
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
