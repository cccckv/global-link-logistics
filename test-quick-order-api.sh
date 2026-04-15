#!/bin/bash

echo "=== QuickOrder API Test Script ==="
echo ""

BASE_URL="http://localhost:3000/api"

echo "1. Testing login to get JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13800138000",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Creating test user first..."
  
  echo "2. Sending verification code..."
  curl -s -X POST "$BASE_URL/auth/send-code" \
    -H "Content-Type: application/json" \
    -d '{
      "phone": "13800138000",
      "type": "register"
    }' | jq '.'
  
  echo ""
  echo "⚠️  Please check the backend logs for the verification code, then register manually."
  echo "   Or use an existing account to test."
  exit 1
fi

echo "✅ Login successful. Token: ${TOKEN:0:20}..."
echo ""

echo "3. Creating a Quick Order (SEA_LCL)..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/orders/quick" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderType": "SEA_LCL",
    "warehouse": "广州仓库",
    "destination": "美国洛杉矶",
    "totalPackages": 3,
    "courierCompany": "顺丰快递",
    "note": "易碎品，小心轻放",
    "additionalServices": ["WOODEN_FRAME", "CUSTOMS"],
    "recipientAddress": {
      "name": "张三",
      "phone": "13900139000",
      "address": "123 Main St, Los Angeles, CA 90001",
      "region": "California",
      "postcode": "90001"
    },
    "pickupAddress": {
      "name": "李四",
      "phone": "13800138000",
      "address": "广州市天河区XX路XX号",
      "region": "广东省/广州市/天河区"
    },
    "declarations": [
      {
        "productName": "电子产品",
        "weight": 10.5,
        "length": 50,
        "width": 40,
        "height": 30,
        "outerQuantity": 2,
        "unitPrice": 500
      },
      {
        "productName": "服装",
        "weight": 5.2,
        "length": 40,
        "width": 30,
        "height": 20,
        "outerQuantity": 1,
        "unitPrice": 200
      }
    ]
  }')

echo "$CREATE_RESPONSE" | jq '.'

ORDER_ID=$(echo $CREATE_RESPONSE | jq -r '.orderId // empty')

if [ -z "$ORDER_ID" ]; then
  echo "❌ Failed to create order"
  exit 1
fi

echo ""
echo "✅ Order created successfully!"
echo "   Order ID: $ORDER_ID"
echo "   Order Number: $(echo $CREATE_RESPONSE | jq -r '.orderNumber')"
echo "   Total Amount: ¥$(echo $CREATE_RESPONSE | jq -r '.totalAmount')"
echo ""

echo "4. Getting order list..."
curl -s -X GET "$BASE_URL/orders/quick" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length as $count | "Total orders: \($count)"'

echo ""

echo "5. Getting order details..."
curl -s -X GET "$BASE_URL/orders/quick/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    orderNumber,
    orderType,
    status,
    destination,
    totalAmount,
    declarations: .declarations | length,
    pickupAddress: .pickupAddress.name,
    recipientAddress: .recipientAddress.name
  }'

echo ""

echo "6. Updating order note..."
curl -s -X PATCH "$BASE_URL/orders/quick/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "note": "更新后的备注：请加急处理"
  }' | jq '{orderNumber, status, note}'

echo ""

echo "7. Cancelling order..."
curl -s -X DELETE "$BASE_URL/orders/quick/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{orderNumber, status, message}'

echo ""
echo "=== Test Complete ==="
