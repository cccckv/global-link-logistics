const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding V2 customer and master data...');

  const customersData = [
    {
      clientCode: 'WH-ZZY-FLB',
      name: 'ZZY 菲律宾专线客户',
      phone: '13900139001',
      company: 'ZZY Trading Co.',
      destinationCountry: '菲律宾',
      destinationPort: '马尼拉南港',
      defaultWarehouse: '广州',
      addresses: [
        {
          name: 'ZZY Manila Warehouse',
          phone: '+63 917 123 4567',
          company: 'ZZY Logistics Hub',
          country: '菲律宾',
          region: 'Metro Manila',
          address: 'Building 5, North Harbor Port Area, Tondo, Manila',
          isDefault: true,
        },
      ],
    },
    {
      clientCode: 'WH-10115',
      name: '10115 龙岩重点商贸',
      phone: '13900139002',
      company: 'Longyan Best Goods Ltd.',
      destinationCountry: '菲律宾',
      destinationPort: '马尼拉南港',
      defaultWarehouse: '龙岩',
      addresses: [
        {
          name: 'Michael Tan',
          phone: '+63 928 888 9999',
          company: 'Tan Import & Export',
          country: '菲律宾',
          region: 'Cebu City',
          address: 'Unit 1201, IT Park, Lahug, Cebu City',
          isDefault: true,
        },
      ],
    },
    {
      clientCode: 'WH-77777',
      name: '77777 大宗出海实业',
      phone: '13900139003',
      company: 'Global Industry Enterprise',
      destinationCountry: '菲律宾',
      destinationPort: '马尼拉北港',
      defaultWarehouse: '广州',
      addresses: [
        {
          name: 'Robert Chen',
          phone: '+63 917 777 7777',
          company: 'Pacific Wholesale Center',
          country: '菲律宾',
          region: 'Manila North',
          address: 'Warehouse A3, Port of Manila North Harbor',
          isDefault: true,
        },
      ],
    },
    {
      clientCode: 'WH-五金',
      name: '五金机电专线客户',
      phone: '13900139004',
      company: 'Hardware Express Group',
      destinationCountry: '印尼',
      destinationPort: '丹戎不碌港',
      defaultWarehouse: '义乌',
      addresses: [
        {
          name: 'Budi Santoso',
          phone: '+62 812 3456 7890',
          company: 'PT Hardware Jaya',
          country: '印尼',
          region: 'Jakarta',
          address: 'Jl. Raya Pelabuhan No. 12, Tanjung Priok, Jakarta Utara',
          isDefault: true,
        },
      ],
    },
    {
      clientCode: 'WH-母婴',
      name: '母婴生活用品专线',
      phone: '13900139005',
      company: 'Baby Care International',
      destinationCountry: '泰国',
      destinationPort: '曼谷港',
      defaultWarehouse: '广州',
      addresses: [
        {
          name: 'Somchai Prasert',
          phone: '+66 81 234 5678',
          company: 'Bangkok Retail Co.',
          country: '泰国',
          region: 'Bangkok',
          address: '88/9 Rama III Road, Yannawa, Bangkok',
          isDefault: true,
        },
      ],
    },
  ];

  for (const item of customersData) {
    const { addresses, ...customerInfo } = item;
    const customer = await prisma.customer.upsert({
      where: { clientCode: customerInfo.clientCode },
      update: customerInfo,
      create: customerInfo,
    });

    for (const addr of addresses) {
      const existing = await prisma.customerAddress.findFirst({
        where: { customerId: customer.id, phone: addr.phone },
      });
      if (!existing) {
        await prisma.customerAddress.create({
          data: {
            ...addr,
            customerId: customer.id,
            addressType: 'OVERSEAS_RECIPIENT',
          },
        });
      }
    }
    console.log(`✅ Customer seeded: ${customer.clientCode} - ${customer.name}`);
  }

  // Seed sample ContainerMaster
  const sampleContainer = await prisma.containerMaster.upsert({
    where: { containerNo: 'MILU6019768' },
    update: {},
    create: {
      containerNo: 'MILU6019768',
      containerType: 'HQ_40',
      blNumber: 'MCLPXMN082208',
      carrier: '万海航运',
      vesselVoyage: 'WAN HAI 312 / V.S012',
      originPort: '南沙港',
      destinationPort: '马尼拉南港',
      bookingChannel: '泉州万海-菲立亚清关公司-渠道5',
      customsChannel: '中外运',
      clearanceChannel: '泉州万海-菲立亚清关公司-渠道5',
      truckingChannel: '优尼科',
      loadingDate: new Date('2026-08-18'),
      status: 'LOADING',
    },
  });
  console.log(`✅ Sample Container Master seeded: ${sampleContainer.containerNo}`);

  console.log('🎉 V2 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
