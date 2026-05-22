const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log("Reading settings from local SQLite prisma/dev.db...");
  
  // We can just read the SQLite binary file directly as a Buffer to extract the AI_API_KEYS JSON string!
  // Since we already proved we can find "AI_API_KEYS" at index 32087 and extract it cleanly,
  // let's write a pure Buffer-based extraction that extracts ALL matching JSON values from prisma/dev.db!
  const dbPath = require('path').join(__dirname, '../prisma/dev.db');
  const buf = fs.readFileSync(dbPath);
  console.log(`Database file loaded: ${buf.length} bytes`);
  
  const foundSettings = {};
  
  // 1. Extract AI_API_KEYS
  const keyName = 'AI_API_KEYS';
  const keyBuf = Buffer.from(keyName);
  const idx = buf.indexOf(keyBuf);
  if (idx !== -1) {
    console.log(`Found ${keyName} at index ${idx}`);
    const searchWindow = buf.subarray(idx, idx + 8000); // 8KB window to capture many keys
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
        let printable = '';
        for (let i = 0; i < jsonBuf.length; i++) {
          const c = jsonBuf[i];
          if (c >= 32 && c <= 126) printable += String.fromCharCode(c);
        }
        try {
          const parsed = JSON.parse(printable);
          console.log("Successfully extracted local API keys pool:", parsed);
          foundSettings[keyName] = printable;
        } catch (e) {
          console.error("Failed to parse extracted JSON, raw:", printable.substring(0, 200));
        }
      }
    }
  }
  
  // If we couldn't parse it, let's try a regex on the printable string of the whole database!
  if (!foundSettings[keyName]) {
    console.log("Attempting fallback string extraction...");
    let dbStr = '';
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c >= 32 && c <= 126) dbStr += String.fromCharCode(c);
      else dbStr += ' ';
    }
    const match = dbStr.match(/AI_API_KEYS\s*(\[\s*\{\s*"id"\s*:\s*".*?\}\s*\])/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        console.log("Successfully parsed local API keys pool via fallback:", parsed);
        foundSettings[keyName] = match[1];
      } catch (err) {
        console.error("Fallback parse failed:", err.message);
      }
    }
  }

  if (!foundSettings[keyName]) {
    console.error("Could not extract AI_API_KEYS from the binary!");
    return;
  }

  console.log("\nConnecting to Neon PostgreSQL to push settings...");
  // Let's instantiate Prisma Client directly connected to Neon PostgreSQL
  process.env.DATABASE_URL = "postgresql://neondb_owner:npg_SerGnWmo0i3j@ep-broad-feather-aq7dbjg0.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";
  const neonPrisma = new PrismaClient();

  const neonAdmin = await neonPrisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (!neonAdmin) {
    console.error("No admin user found in Neon PostgreSQL!");
    await neonPrisma.$disconnect();
    return;
  }

  console.log(`Neon admin user ID: ${neonAdmin.id}`);

  // Upsert the setting in Neon Postgres
  await neonPrisma.systemSetting.upsert({
    where: {
      userId_key: {
        userId: neonAdmin.id,
        key: keyName
      }
    },
    update: {
      value: foundSettings[keyName]
    },
    create: {
      userId: neonAdmin.id,
      key: keyName,
      value: foundSettings[keyName]
    }
  });

  console.log(`Successfully migrated '${keyName}' directly to your live Vercel Neon database!`);
  await neonPrisma.$disconnect();
}

main().catch(console.error);
