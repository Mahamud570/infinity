const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users in database:");
  for (const u of users) {
    console.log(`- Username: ${u.username}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
