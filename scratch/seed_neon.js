const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking if admin user exists in Neon database...");
  const existingUser = await prisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (!existingUser) {
    console.log("Admin user does not exist. Creating admin user...");
    const passwordHash = await bcrypt.hash('admin123', 10);
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash
      }
    });
    console.log("Successfully created admin user on Neon!");
  } else {
    console.log("Admin user already exists in Neon database!");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
