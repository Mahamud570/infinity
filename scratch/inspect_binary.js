const fs = require('fs');
const path = require('path');

function main() {
  const p = path.join(__dirname, '../prisma/dev.db');
  if (!fs.existsSync(p)) {
    console.error("File not found!");
    return;
  }
  const buf = fs.readFileSync(p);
  console.log("File size:", buf.length);
  
  // Search for occurrence of "admin" or "API"
  const searchTerms = ["admin", "API", "GEMINI", "gemini", "active"];
  for (const term of searchTerms) {
    const termBuf = Buffer.from(term);
    let idx = -1;
    let occurrences = [];
    while ((idx = buf.indexOf(termBuf, idx + 1)) !== -1) {
      occurrences.push(idx);
    }
    console.log(`Term "${term}" found at ${occurrences.length} indices:`, occurrences.slice(0, 10));
    
    if (occurrences.length > 0) {
      const firstIdx = occurrences[0];
      const start = Math.max(0, firstIdx - 50);
      const end = Math.min(buf.length, firstIdx + 150);
      const chunk = buf.subarray(start, end);
      // print printable chars
      let s = '';
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (c >= 32 && c <= 126) s += String.fromCharCode(c);
        else s += '.';
      }
      console.log(`Context around ${firstIdx}:`, s);
    }
  }
}

main();
