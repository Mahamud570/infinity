import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import prisma from '@/lib/prisma';

// Global index for the rotator (kept in memory, resets on serverless cold starts but that's fine)
let currentKeyIndex = 0;

export async function handleChatRequest(formattedHistory: Content[], userPrompt: string) {
  const startTime = Date.now();
  
  // Fetch keys from DB
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'GEMINI_API_KEYS' },
  });
  
  let API_KEYS: string[] = [];
  if (setting && setting.value) {
    try {
      API_KEYS = JSON.parse(setting.value);
    } catch (e) {
      console.error("Failed to parse API keys from DB");
    }
  }

  // Fallback to env if DB is empty
  if (API_KEYS.length === 0) {
    const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    API_KEYS = keysStr.split(',').map(k => k.trim()).filter(Boolean);
  }

  if (API_KEYS.length === 0) {
    await logInference(null, null, Date.now() - startTime, false, "No API keys configured");
    throw new Error("No Google Gemini API keys configured.");
  }

  // Calculate rough prompt length
  const promptLength = formattedHistory.reduce((acc, curr) => acc + (curr.parts[0]?.text?.length || 0), 0) + userPrompt.length;

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    try {
      // Ensure index is within bounds (in case keys were removed)
      currentKeyIndex = currentKeyIndex % API_KEYS.length;
      const apiKey = API_KEYS[currentKeyIndex];
      const ai = new GoogleGenerativeAI(apiKey);
      
      const modelName = "gemini-1.5-pro";
      const model = ai.getGenerativeModel({ model: modelName });
      
      const payload: Content[] = [
        ...formattedHistory, 
        { role: "user", parts: [{ text: userPrompt }] }
      ];

      const response = await model.generateContent({ contents: payload });
      const latency = Date.now() - startTime;
      
      await logInference(modelName, currentKeyIndex, latency, true, null, promptLength);
      
      return { 
        text: response.text, 
        modelUsed: modelName, 
        keyIndexUsed: currentKeyIndex 
      };

    } catch (error: any) {
      console.error(`Error with key index ${currentKeyIndex}:`, error.status, error.message);
      
      if (error.status === 429 || error.status === 403 || error.message?.includes('429') || error.message?.includes('quota')) {
        console.warn(`Key Index ${currentKeyIndex} limited. Rotating to next key...`);
        // Log rotation failure
        await logInference("gemini-1.5-pro", currentKeyIndex, Date.now() - startTime, false, "Rate limited or Quota exceeded", promptLength);
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        continue;
      }
      
      if (error.status === 503 || error.message?.includes('overloaded')) {
         try {
           console.warn("Falling back to gemini-1.5-flash...");
           const apiKey = API_KEYS[currentKeyIndex];
           const ai = new GoogleGenerativeAI(apiKey);
           const fallbackModelName = "gemini-1.5-flash";
           const fallbackModel = ai.getGenerativeModel({ model: fallbackModelName });
           
           const payload: Content[] = [
             ...formattedHistory, 
             { role: "user", parts: [{ text: userPrompt }] }
           ];
     
           const response = await fallbackModel.generateContent({ contents: payload });
           const latency = Date.now() - startTime;
           
           await logInference(fallbackModelName, currentKeyIndex, latency, true, null, promptLength);
           
           return { 
             text: response.text, 
             modelUsed: fallbackModelName, 
             keyIndexUsed: currentKeyIndex 
           };
         } catch (fallbackError: any) {
            console.error("Fallback to flash also failed.", fallbackError);
            await logInference("gemini-1.5-flash", currentKeyIndex, Date.now() - startTime, false, fallbackError.message, promptLength);
         }
      }

      await logInference("unknown", currentKeyIndex, Date.now() - startTime, false, error.message, promptLength);
      throw error;
    }
  }
  
  throw new Error("All keys and models in the pool are temporarily exhausted.");
}

async function logInference(modelUsed: string | null, keyIndexUsed: number | null, latencyMs: number, success: boolean, errorMessage: string | null = null, promptLength: number | null = null) {
  try {
    await prisma.inferenceLog.create({
      data: {
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
