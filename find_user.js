const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany().then(function(users) {
  console.log(JSON.stringify(users, null, 2));
  return p.$disconnect();
});
