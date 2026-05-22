const fs = require('fs');
const path = require('path');

function main() {
  // Try both locations
  const dbPaths = [
    path.join(__dirname, '../prisma/dev.db'),
    path.join(__dirname, '../dev.db')
  ];
  
  let buf = null;
  let selectedPath = '';
  for (const p of dbPaths) {
    if (fs.existsSync(p)) {
      buf = fs.readFileSync(p);
      selectedPath = p;
      console.log(`Found database file at: ${p} (${buf.length} bytes)`);
      break;
    }
  }
  
  if (!buf) {
    console.error("No database files found in either location!");
    return;
  }
  
  const keys = [
    'GEMINI_API_KEYS',
    'OPENAI_API_KEYS',
    'ANTHROPIC_API_KEYS',
    'GROQ_API_KEYS',
    'OPENROUTER_API_KEYS',
    'MISTRAL_API_KEYS',
    'COHERE_API_KEYS',
    'HUGGINGFACE_API_KEYS',
    'ACTIVE_PROVIDERS'
  ];
  
  const foundSettings = {};
  
  for (const key of keys) {
    const keyBuf = Buffer.from(key);
    const idx = buf.indexOf(keyBuf);
    if (idx !== -1) {
      console.log(`\nFound key: ${key} at index ${idx}`);
      // Find the JSON block starting with '[' near this index (within next 1500 bytes)
      const searchWindow = buf.subarray(idx, idx + 2000);
      const startBracketIdx = searchWindow.indexOf('['.charCodeAt(0));
      if (startBracketIdx !== -1) {
        let openCount = 0;
        let endBracketIdx = -1;
        for (let i = startBracketIdx; i < searchWindow.length; i++) {
          if (searchWindow[i] === '['.charCodeAt(0)) openCount++;
          else if (searchWindow[i] === ']'.charCodeAt(0)) {
            openCount--;
            if (openCount === 0) {
              endBracketIdx = i;
              break;
            }
          }
        }
        if (endBracketIdx !== -1) {
          const jsonBuf = searchWindow.subarray(startBracketIdx, endBracketIdx + 1);
          // remove any non-printable or null characters
          const cleanStr = jsonBuf.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, "");
          try {
            const parsed = JSON.parse(cleanStr);
            console.log(`Successfully parsed JSON for ${key}:`, parsed);
            foundSettings[key] = cleanStr;
          } catch (e) {
            console.log(`Failed to parse string for ${key}:`, cleanStr.substring(0, 100));
            // Let's try to extract standard printable characters manually
            let printable = '';
            for (let i = 0; i < jsonBuf.length; i++) {
              const c = jsonBuf[i];
              if (c >= 32 && c <= 126) printable += String.fromCharCode(c);
            }
            try {
              const parsedP = JSON.parse(printable);
              console.log(`Parsed printable JSON for ${key}:`, parsedP);
              foundSettings[key] = printable;
            } catch (err) {
              console.log(`Failed printable parse for ${key}:`, printable.substring(0, 100));
            }
          }
        }
      }
    }
  }
  
  fs.writeFileSync('scratch/temp_keys.json', JSON.stringify(foundSettings, null, 2));
  console.log("\nSaved found keys to scratch/temp_keys.json!");
}

main();
