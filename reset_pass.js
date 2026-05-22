const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const newPassword = 'admin123';
bcrypt.hash(newPassword, 10).then(function(hash) {
  return p.user.update({
    where: { username: 'admin' },
    data: { passwordHash: hash }
  });
}).then(function() {
  console.log('Password reset to: ' + newPassword);
  return p.$disconnect();
});
