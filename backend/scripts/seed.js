const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');
  
  const adminPhone = '15060850289';
  const passwordHash = await bcrypt.hash('wh123456', 10);

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      userRole: 'ADMIN',
      userType: 'EMPLOYEE',
    },
    create: {
      id: '3fdd3d80-2aef-4075-bd22-808a0f9aa4d6',
      name: '超级管理员',
      phone: adminPhone,
      passwordHash: passwordHash,
      userRole: 'ADMIN',
      userType: 'EMPLOYEE',
    },
  });

  console.log('✅ Admin user created/verified:');
  console.log('   - 姓名:', admin.name);
  console.log('   - 手机号:', admin.phone);
  console.log('   - 初始密码: wh123456');
  console.log('   - 角色:', admin.userRole);

  // Test customer user
  const customerPhone = '13800138000';
  const customerPass = await bcrypt.hash('123456', 10);
  const customer = await prisma.user.upsert({
    where: { phone: customerPhone },
    update: {},
    create: {
      name: '测试客户',
      phone: customerPhone,
      passwordHash: customerPass,
      userRole: 'USER',
      userType: 'CUSTOMER',
    },
  });

  console.log('✅ Customer user created/verified:');
  console.log('   - 姓名:', customer.name);
  console.log('   - 手机号:', customer.phone);
  console.log('   - 初始密码: 123456');
  console.log('   - 角色:', customer.userRole);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
