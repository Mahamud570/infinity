const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.update({
    where: { username: 'admin' },
    data: { passwordHash }
  });
  console.log("Successfully set user 'admin' password to 'admin123'!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
