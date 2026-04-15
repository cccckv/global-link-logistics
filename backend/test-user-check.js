const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const testUserId = 'da47e29b-5fea-411d-9b77-f3d7c98e68ad';
    
    console.log('1. Checking if user exists...');
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    console.log('User:', user);
    
    console.log('\n2. Trying to create recipient address with this userId...');
    try {
      const addr = await prisma.orderRecipientAddress.create({
        data: {
          userId: testUserId,
          name: 'Test User',
          phone: '15959103085',
          address: 'Test Address'
        }
      });
      console.log('Success:', addr);
    } catch (err) {
      console.error('Error:', err.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
