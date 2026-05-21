const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  const genAI = new GoogleGenerativeAI("AIzaSyBZKAIZfgZMZoT9gY6U9R4f6aTAMbJKbVE");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Say hello and tell me a fun fact in 2 sentences.");
    console.log("✅ SUCCESS! Response:", result.response.text());
  } catch (e) {
    console.error("❌ Error:", e.message.substring(0, 300));
  }
}

run();
