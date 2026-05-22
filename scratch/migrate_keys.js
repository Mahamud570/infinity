const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log("1. Reading local configurations from SQLite...");
  process.env.DATABASE_URL = "file:./dev.db";
  const localPrisma = new PrismaClient();
  
  // Find local admin user
  const localAdmin = await localPrisma.user.findUnique({
    where: { username: 'admin' },
    include: { settings: true }
  });
  
  if (!localAdmin) {
    console.error("No local admin user found in SQLite database!");
    await localPrisma.$disconnect();
    return;
  }
  
  console.log(`Found ${localAdmin.settings.length} settings in local database.`);
  const localSettings = localAdmin.settings;
  await localPrisma.$disconnect();

  console.log("\n2. Writing configurations to Neon PostgreSQL...");
  process.env.DATABASE_URL = "postgresql://neondb_owner:npg_SerGnWmo0i3j@ep-broad-feather-aq7dbjg0.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";
  const neonPrisma = new PrismaClient();

  // Find Neon admin user
  const neonAdmin = await neonPrisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (!neonAdmin) {
    console.error("No admin user found in Neon PostgreSQL!");
    await neonPrisma.$disconnect();
    return;
  }

  console.log(`Neon admin user ID: ${neonAdmin.id}`);

  for (const s of localSettings) {
    console.log(`Migrating setting '${s.key}'...`);
    await neonPrisma.systemSetting.upsert({
      where: {
        userId_key: {
          userId: neonAdmin.id,
          key: s.key
        }
      },
      update: {
        value: s.value
      },
      create: {
        userId: neonAdmin.id,
        key: s.key,
        value: s.value
      }
    });
  }

  console.log("\nSuccessfully migrated all API keys and settings to Neon cloud database!");
  await neonPrisma.$disconnect();
}

main().catch(console.error);
