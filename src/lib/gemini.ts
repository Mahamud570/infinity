import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import prisma from '@/lib/prisma';

// Global index for the rotator (kept in memory, resets on serverless cold starts but that's fine)
let currentKeyIndex = 0;

export async function handleChatRequest(
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
    try {
      allKeys = JSON.parse(setting.value);
    } catch (e) {
      console.error("Failed to parse API keys from DB");
    }
  }

  let API_KEYS: string[] = allKeys.filter(k => k.provider === 'gemini').map(k => k.key);

  // Fallback to env if DB is empty
  if (API_KEYS.length === 0) {
    const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    API_KEYS = keysStr.split(',').map(k => k.trim()).filter(Boolean);
  }

  if (API_KEYS.length === 0) {
    await logInference(userId, null, null, Date.now() - startTime, false, "No API keys configured");
    throw new Error("No Google Gemini API keys configured. Please add keys in settings.");
  }

  // Calculate rough prompt length
  const promptLength = formattedHistory.reduce((acc, curr) => acc + (curr.parts[0]?.text?.length || 0), 0) + userPrompt.length;

  const MODELS_TO_TRY = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

  let lastErrorMessage = '';

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    currentKeyIndex = currentKeyIndex % API_KEYS.length;
    const apiKey = API_KEYS[currentKeyIndex];

    for (const modelName of MODELS_TO_TRY) {
      try {
        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: modelName });

        const userParts: any[] = [];
        if (userPrompt) userParts.push({ text: userPrompt });
        if (image) userParts.push({ inlineData: { data: image.base64, mimeType: image.mimeType } });
        if (userParts.length === 0) userParts.push({ text: '' });

        const payload: Content[] = [...formattedHistory, { role: 'user', parts: userParts }];
        
        // Strict role alternation check: Merge consecutive messages with the same role (e.g. user/user or model/model) to prevent 400 Bad Request validation errors
        const sanitizedPayload: Content[] = [];
        for (const item of payload) {
          if (sanitizedPayload.length > 0 && sanitizedPayload[sanitizedPayload.length - 1].role === item.role) {
            sanitizedPayload[sanitizedPayload.length - 1].parts.push(...item.parts);
          } else {
            sanitizedPayload.push({
              role: item.role,
              parts: [...item.parts]
            });
          }
        }

        const response = await model.generateContent({ contents: sanitizedPayload });
        const latency = Date.now() - startTime;

        await logInference(userId, modelName, currentKeyIndex, latency, true, null, promptLength);

        return { text: response.response.text(), modelUsed: modelName, keyIndexUsed: currentKeyIndex };

      } catch (error: any) {
        lastErrorMessage = error.message || 'Unknown error';
        console.warn(`Key[${currentKeyIndex}] model[${modelName}] failed: ${error.status} ${lastErrorMessage.substring(0, 80)}`);
        await logInference(userId, modelName, currentKeyIndex, Date.now() - startTime, false, lastErrorMessage.substring(0, 255), promptLength);

        // On quota/billing error, rotate key and break model loop
        if (error.status === 429 || error.status === 403 || lastErrorMessage.includes('quota') || lastErrorMessage.includes('429')) {
          break; // break model loop, go to next key
        }
        // On 503 overload, try next model with same key
        // On other errors, also try next model
      }
    }

    // Move to next key
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  }

  throw new Error(`All Gemini keys and models failed. Last error: ${lastErrorMessage.substring(0, 150)}`);
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
  } catch (err) {
    console.error("Failed to write to inference log:", err);
  }
}
