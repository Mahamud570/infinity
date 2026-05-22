const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log("Reading keys from local SQLite...");
  const prisma = new PrismaClient();
  const admin = await prisma.user.findUnique({
    where: { username: 'admin' },
    include: { settings: true }
  });
  
  if (!admin) {
    console.error("Local admin user not found!");
    await prisma.$disconnect();
    return;
  }
  
  console.log(`Found ${admin.settings.length} settings!`);
  fs.writeFileSync('scratch/temp_keys.json', JSON.stringify(admin.settings, null, 2));
  console.log("Saved local keys to scratch/temp_keys.json!");
  await prisma.$disconnect();
}

main().catch(console.error);
