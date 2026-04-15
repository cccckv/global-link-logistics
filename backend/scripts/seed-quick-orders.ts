import { PrismaClient, QuickOrderType, QuickOrderStatus, AdditionalService } from '@prisma/client';

const prisma = new PrismaClient();

const destinations = ['美国洛杉矶', '美国纽约', '美国旧金山', '加拿大多伦多', '英国伦敦', '德国柏林', '法国巴黎', '澳大利亚悉尼', '日本东京', '新加坡'];
const warehouses = ['深圳仓', '广州仓', '上海仓', '北京仓', '义乌仓'];
const courierCompanies = ['顺丰速运', 'DHL', 'FedEx', 'UPS', 'EMS'];
const productNames = ['电子产品', '服装鞋帽', '家居用品', '玩具', '食品', '化妆品', '五金工具', '办公用品', '运动器材', '图书'];

const statuses: QuickOrderStatus[] = ['PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
const orderTypes: QuickOrderType[] = ['SEA_LCL', 'AIR', 'LAND', 'SEA_FCL', 'PARCEL'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTrackingNumber(): string {
  const prefix = randomFrom(['SF', 'DHL', 'FDX', 'UPS', 'EMS']);
  const number = Math.random().toString(36).substring(2, 15).toUpperCase();
  return `${prefix}${number}`;
}

function generateMark(): string {
  const marks = ['FRAGILE', 'HANDLE WITH CARE', 'URGENT', 'ELECTRONICS', 'TEXTILE', 'FOOD', 'COSMETICS'];
  return randomFrom(marks) + '-' + randomInt(1000, 9999);
}

async function seedQuickOrders(userId: string, count: number) {
  console.log(`Creating ${count} quick orders for user ${userId}...`);

  for (let i = 0; i < count; i++) {
    const orderType = randomFrom(orderTypes);
    const status = randomFrom(statuses);
    const isFCL = orderType === 'SEA_FCL';
    
    const timestamp = Date.now() - randomInt(0, 90 * 24 * 60 * 60 * 1000);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderNumber = `GL${timestamp}${random}`;

    const pickupAddress = {
      name: '张三',
      company: '深圳进出口有限公司',
      phone: '13800138000',
      region: '广东省深圳市南山区',
      postcode: '518000',
      address: '科技园南区深南大道10000号',
    };

    const recipientAddress = {
      name: 'John Smith',
      company: 'ABC Trading Inc.',
      phone: '+1-555-0123',
      region: randomFrom(destinations),
      postcode: randomInt(10000, 99999).toString(),
      address: `${randomInt(100, 9999)} Main Street, Suite ${randomInt(100, 999)}`,
    };

    const totalPackages = randomInt(1, 20);
    const declarations = !isFCL
      ? Array.from({ length: randomInt(1, 5) }, (_, idx) => {
          const weight = randomInt(5, 100);
          const length = randomInt(20, 100);
          const width = randomInt(20, 80);
          const height = randomInt(10, 60);
          
          return {
            trackingNumber: Math.random() > 0.5 ? generateTrackingNumber() : undefined,
            productName: randomFrom(productNames),
            length,
            width,
            height,
            weight,
            cnyUnitPrice: randomInt(10, 500),
            phpUnitPrice: randomInt(100, 5000),
          };
        })
      : [];

    const containers = isFCL
      ? Array.from({ length: randomInt(1, 3) }, () => ({
          containerType: randomFrom(['GP_20', 'GP_40', 'HQ_40', 'HQ_45'] as const),
          quantity: randomInt(1, 3),
          weight: randomInt(5000, 20000),
          productsJson: JSON.stringify([
            { name: randomFrom(productNames), quantity: randomInt(100, 1000), weight: randomInt(1000, 5000) },
            { name: randomFrom(productNames), quantity: randomInt(100, 1000), weight: randomInt(1000, 5000) },
          ]),
        }))
      : [];

    const totalAmount = isFCL
      ? randomInt(8000, 15000)
      : declarations.reduce((sum, d) => sum + d.weight, 0) * randomInt(5, 15);

    const additionalServices: AdditionalService[] = [];
    if (Math.random() > 0.5) additionalServices.push('WOODEN_FRAME');
    if (Math.random() > 0.6) additionalServices.push('CUSTOMS');
    if (Math.random() > 0.7) additionalServices.push('DELIVERY');

    try {
      await prisma.quickOrder.create({
        data: {
          orderNumber,
          userId,
          orderType,
          status,
          warehouse: !isFCL ? randomFrom(warehouses) : undefined,
          destination: randomFrom(destinations),
          trackingNumber: !isFCL ? generateTrackingNumber() : undefined,
          courierCompany: !isFCL ? randomFrom(courierCompanies) : undefined,
          totalPackages,
          note: Math.random() > 0.5 ? `备注信息 ${i + 1}` : undefined,
          userMark: generateMark(),
          mark: Math.random() > 0.5 ? generateMark() : undefined,
          originPort: isFCL ? '深圳盐田港' : undefined,
          destinationPort: isFCL ? `${randomFrom(destinations)}港` : undefined,
          additionalServices,
          totalAmount,
          currency: 'CNY',
          createdAt: new Date(timestamp),
          
          pickupAddress: {
            create: pickupAddress,
          },
          
          recipientAddress: {
            create: recipientAddress,
          },
          
          declarations: declarations.length > 0
            ? {
                create: declarations,
              }
            : undefined,
          
          containers: containers.length > 0
            ? {
                create: containers,
              }
            : undefined,
        },
      });

      if ((i + 1) % 10 === 0) {
        console.log(`Created ${i + 1} orders...`);
      }
    } catch (error) {
      console.error(`Error creating order ${i + 1}:`, error);
    }
  }

  console.log(`✅ Successfully created ${count} quick orders`);
}

async function main() {
  const testUserPhone = 'jiay0202';
  
  let user = await prisma.user.findUnique({
    where: { phone: testUserPhone },
  });

  if (!user) {
    console.log('Test user not found, creating one...');
    user = await prisma.user.create({
      data: {
        phone: testUserPhone,
        passwordHash: '$2b$10$0PQZhGJYHZQNZQjXQKZGZO.8hXZQK5ZQK5ZQK5ZQK5ZQK5ZQK5ZQK',
        name: 'Test User',
        userType: 'CUSTOMER',
      },
    });
    console.log(`✅ Created test user: ${user.id}`);
  } else {
    console.log(`Found existing user: ${user.id}`);
  }

  const existingCount = await prisma.quickOrder.count({
    where: { userId: user.id },
  });

  console.log(`Existing quick orders: ${existingCount}`);

  const ordersToCreate = 50 - existingCount;
  
  if (ordersToCreate > 0) {
    await seedQuickOrders(user.id, ordersToCreate);
  } else {
    console.log('Already have enough orders, skipping seed');
  }

  const finalCount = await prisma.quickOrder.count({
    where: { userId: user.id },
  });

  console.log(`\n📊 Final Statistics:`);
  console.log(`Total Orders: ${finalCount}`);
  
  const statusCounts = await Promise.all(
    statuses.map(async (status) => ({
      status,
      count: await prisma.quickOrder.count({ where: { userId: user.id, status } }),
    }))
  );

  console.log('\nBy Status:');
  statusCounts.forEach(({ status, count }) => {
    console.log(`  ${status}: ${count}`);
  });

  const typeCounts = await Promise.all(
    orderTypes.map(async (type) => ({
      type,
      count: await prisma.quickOrder.count({ where: { userId: user.id, orderType: type } }),
    }))
  );

  console.log('\nBy Type:');
  typeCounts.forEach(({ type, count }) => {
    console.log(`  ${type}: ${count}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
