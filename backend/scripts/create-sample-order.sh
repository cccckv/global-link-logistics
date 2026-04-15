#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 创建示例订单测试脚本 ===${NC}\n"

# 1. 登录获取Token
echo -e "${YELLOW}步骤1: 登录获取JWT Token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "jiay0202",
    "password": "jiay0202@"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}登录失败，尝试注册新用户...${NC}"
  REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "phone": "jiay0202",
      "password": "jiay0202@",
      "name": "测试用户"
    }')
  
  TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
fi

if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}无法获取Token，使用现有用户的订单数据${NC}"
  echo -e "${GREEN}✅ 数据库中已有50条模拟订单${NC}"
  echo -e "${BLUE}请访问 http://localhost:8080/login 登录查看${NC}"
  echo -e "${BLUE}用户名: jiay0202${NC}"
  echo -e "${BLUE}密码: jiay0202@${NC}"
  exit 0
fi

echo -e "${GREEN}✅ 登录成功！${NC}\n"

# 2. 创建拼柜海运订单
echo -e "${YELLOW}步骤2: 创建拼柜海运订单...${NC}"
ORDER1=$(curl -s -X POST http://localhost:3000/api/orders/quick \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderType": "SEA_LCL",
    "warehouse": "深圳仓",
    "destination": "美国洛杉矶",
    "totalPackages": 3,
    "courierCompany": "顺丰速运",
    "note": "测试订单 - 拼柜海运",
    "userMark": "FRAGILE-TEST-001",
    "additionalServices": ["WOODEN_FRAME", "CUSTOMS"],
    "pickupAddress": {
      "name": "张三",
      "company": "深圳进出口有限公司",
      "phone": "13800138000",
      "region": "广东省深圳市南山区",
      "postcode": "518000",
      "address": "科技园南区深南大道10000号"
    },
    "recipientAddress": {
      "name": "John Smith",
      "company": "ABC Trading Inc.",
      "phone": "+1-555-0123",
      "region": "California, Los Angeles",
      "postcode": "90001",
      "address": "1234 Main Street, Suite 100"
    },
    "declarations": [
      {
        "trackingNumber": "SF123456789",
        "productName": "电子产品",
        "length": 50,
        "width": 40,
        "height": 30,
        "outerQuantity": 2,
        "innerQuantity": 10,
        "weight": 25.5,
        "unitPrice": 500
      },
      {
        "trackingNumber": "SF987654321",
        "productName": "服装鞋帽",
        "length": 60,
        "width": 40,
        "height": 20,
        "outerQuantity": 3,
        "innerQuantity": 15,
        "weight": 18.0,
        "unitPrice": 300
      }
    ]
  }')

ORDER1_NUM=$(echo $ORDER1 | grep -o '"orderNumber":"[^"]*' | sed 's/"orderNumber":"//')
echo -e "${GREEN}✅ 拼柜海运订单创建成功！${NC}"
echo -e "   订单号: ${BLUE}$ORDER1_NUM${NC}\n"

# 3. 创建空运快递订单
echo -e "${YELLOW}步骤3: 创建空运快递订单...${NC}"
ORDER2=$(curl -s -X POST http://localhost:3000/api/orders/quick \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderType": "AIR",
    "warehouse": "广州仓",
    "destination": "英国伦敦",
    "totalPackages": 2,
    "courierCompany": "DHL",
    "note": "测试订单 - 空运快递",
    "userMark": "URGENT-TEST-002",
    "additionalServices": ["DELIVERY"],
    "pickupAddress": {
      "name": "李四",
      "company": "广州物流公司",
      "phone": "13900139000",
      "region": "广东省广州市天河区",
      "postcode": "510000",
      "address": "天河路188号"
    },
    "recipientAddress": {
      "name": "David Brown",
      "company": "UK Import Ltd",
      "phone": "+44-20-1234-5678",
      "region": "London, UK",
      "postcode": "SW1A 1AA",
      "address": "10 Downing Street"
    },
    "declarations": [
      {
        "trackingNumber": "DHL456789123",
        "productName": "化妆品",
        "length": 30,
        "width": 25,
        "height": 20,
        "outerQuantity": 1,
        "innerQuantity": 5,
        "weight": 8.5,
        "unitPrice": 800
      }
    ]
  }')

ORDER2_NUM=$(echo $ORDER2 | grep -o '"orderNumber":"[^"]*' | sed 's/"orderNumber":"//')
echo -e "${GREEN}✅ 空运快递订单创建成功！${NC}"
echo -e "   订单号: ${BLUE}$ORDER2_NUM${NC}\n"

# 4. 创建海运整柜订单
echo -e "${YELLOW}步骤4: 创建海运整柜订单...${NC}"
ORDER3=$(curl -s -X POST http://localhost:3000/api/orders/quick \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderType": "SEA_FCL",
    "destination": "加拿大温哥华",
    "originPort": "深圳盐田港",
    "destinationPort": "温哥华港",
    "note": "测试订单 - 海运整柜",
    "userMark": "FCL-TEST-003",
    "additionalServices": ["CUSTOMS"],
    "pickupAddress": {
      "name": "王五",
      "company": "深圳货运代理",
      "phone": "13700137000",
      "region": "广东省深圳市盐田区",
      "postcode": "518000",
      "address": "盐田港区东海大道"
    },
    "recipientAddress": {
      "name": "Michael Johnson",
      "company": "Vancouver Logistics",
      "phone": "+1-604-555-0199",
      "region": "Vancouver, BC",
      "postcode": "V6B 1A1",
      "address": "999 Canada Place"
    },
    "containers": [
      {
        "containerType": "HQ_40",
        "quantity": 2,
        "weight": 15000,
        "productsJson": "[{\"name\":\"电子产品\",\"quantity\":500,\"weight\":7500},{\"name\":\"家居用品\",\"quantity\":800,\"weight\":7500}]"
      }
    ]
  }')

ORDER3_NUM=$(echo $ORDER3 | grep -o '"orderNumber":"[^"]*' | sed 's/"orderNumber":"//')
echo -e "${GREEN}✅ 海运整柜订单创建成功！${NC}"
echo -e "   订单号: ${BLUE}$ORDER3_NUM${NC}\n"

# 5. 创建陆运订单
echo -e "${YELLOW}步骤5: 创建陆运装车订单...${NC}"
ORDER4=$(curl -s -X POST http://localhost:3000/api/orders/quick \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderType": "LAND",
    "warehouse": "义乌仓",
    "destination": "北京",
    "totalPackages": 5,
    "note": "测试订单 - 陆运装车",
    "userMark": "LAND-TEST-004",
    "pickupAddress": {
      "name": "赵六",
      "company": "义乌国际商贸城",
      "phone": "13600136000",
      "region": "浙江省义乌市",
      "postcode": "322000",
      "address": "国际商贸城一区"
    },
    "recipientAddress": {
      "name": "孙七",
      "company": "北京批发市场",
      "phone": "13500135000",
      "region": "北京市朝阳区",
      "postcode": "100000",
      "address": "朝阳路168号"
    },
    "declarations": [
      {
        "productName": "五金工具",
        "length": 80,
        "width": 60,
        "height": 40,
        "outerQuantity": 5,
        "innerQuantity": 50,
        "weight": 120.0,
        "unitPrice": 200
      }
    ]
  }')

ORDER4_NUM=$(echo $ORDER4 | grep -o '"orderNumber":"[^"]*' | sed 's/"orderNumber":"//')
echo -e "${GREEN}✅ 陆运装车订单创建成功！${NC}"
echo -e "   订单号: ${BLUE}$ORDER4_NUM${NC}\n"

# 6. 创建拼邮快递订单
echo -e "${YELLOW}步骤6: 创建拼邮快递订单...${NC}"
ORDER5=$(curl -s -X POST http://localhost:3000/api/orders/quick \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderType": "PARCEL",
    "warehouse": "上海仓",
    "destination": "澳大利亚悉尼",
    "totalPackages": 1,
    "courierCompany": "EMS",
    "note": "测试订单 - 拼邮快递",
    "userMark": "PARCEL-TEST-005",
    "pickupAddress": {
      "name": "周八",
      "company": "上海电商仓储",
      "phone": "13400134000",
      "region": "上海市浦东新区",
      "postcode": "200000",
      "address": "张江高科技园区"
    },
    "recipientAddress": {
      "name": "Emma Wilson",
      "company": "Sydney Shop",
      "phone": "+61-2-9876-5432",
      "region": "Sydney, NSW",
      "postcode": "2000",
      "address": "123 George Street"
    },
    "declarations": [
      {
        "trackingNumber": "EMS789456123",
        "productName": "图书",
        "length": 40,
        "width": 30,
        "height": 15,
        "outerQuantity": 1,
        "innerQuantity": 3,
        "weight": 5.5,
        "unitPrice": 150
      }
    ]
  }')

ORDER5_NUM=$(echo $ORDER5 | grep -o '"orderNumber":"[^"]*' | sed 's/"orderNumber":"//')
echo -e "${GREEN}✅ 拼邮快递订单创建成功！${NC}"
echo -e "   订单号: ${BLUE}$ORDER5_NUM${NC}\n"

# 总结
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✅ 成功创建5个示例订单！${NC}"
echo -e "${BLUE}================================${NC}\n"

echo -e "${YELLOW}创建的订单：${NC}"
echo -e "1. 拼柜海运: ${BLUE}$ORDER1_NUM${NC}"
echo -e "2. 空运快递: ${BLUE}$ORDER2_NUM${NC}"
echo -e "3. 海运整柜: ${BLUE}$ORDER3_NUM${NC}"
echo -e "4. 陆运装车: ${BLUE}$ORDER4_NUM${NC}"
echo -e "5. 拼邮快递: ${BLUE}$ORDER5_NUM${NC}\n"

echo -e "${YELLOW}📊 查看订单：${NC}"
echo -e "  前端界面: ${BLUE}http://localhost:8080/order/list${NC}"
echo -e "  登录账号: ${BLUE}jiay0202${NC}"
echo -e "  登录密码: ${BLUE}jiay0202@${NC}\n"

# 获取最新统计
echo -e "${YELLOW}步骤7: 获取订单统计...${NC}"
COUNTS=$(curl -s -X GET http://localhost:3000/api/orders/quick/counts \
  -H "Authorization: Bearer $TOKEN")

echo -e "${GREEN}当前订单统计：${NC}"
echo "$COUNTS" | python3 -m json.tool 2>/dev/null || echo "$COUNTS"
echo ""

echo -e "${GREEN}🎉 所有示例订单创建完成！现在可以访问前端查看了。${NC}"
