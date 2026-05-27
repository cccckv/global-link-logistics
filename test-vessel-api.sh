#!/bin/bash

echo "========================================="
echo "船舶位置查询API测试脚本（更新版）"
echo "========================================="
echo ""

API_URL="http://localhost:3000/api"

echo "1. 测试未登录访问搜索接口（应返回401）"
echo "GET ${API_URL}/vessel/search?keywords=cosco"
curl -s -w "\nHTTP Status: %{http_code}\n" "${API_URL}/vessel/search?keywords=cosco"
echo ""
echo "========================================="
echo ""

echo "2. 请先登录获取token，然后手动测试："
echo ""
echo "登录命令示例："
echo 'curl -X POST ${API_URL}/auth/login -H "Content-Type: application/json" -d '"'"'{"phone":"your-phone","password":"your-password"}'"'"
echo ""
echo "获取token后执行："
echo 'TOKEN="your-jwt-token-here"'
echo ""
echo "# 搜索船舶"
echo 'curl -H "Authorization: Bearer $TOKEN" "${API_URL}/vessel/search?keywords=cosco&max=5"'
echo ""
echo "# 获取详细位置"
echo 'curl -H "Authorization: Bearer $TOKEN" "${API_URL}/vessel/position?mmsi=413961925"'
echo ""
echo "========================================="
echo ""

TOKEN="${1:-invalid-token}"

if [ "$TOKEN" != "invalid-token" ]; then
  echo "3. 测试搜索接口（使用提供的token）"
  echo ""
  
  echo "3.1 搜索船名："
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${API_URL}/vessel/search?keywords=cosco&max=3"
  echo ""
  
  echo "3.2 搜索MMSI："
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${API_URL}/vessel/search?keywords=413961925"
  echo ""
  
  echo "3.3 获取详细位置："
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${API_URL}/vessel/position?mmsi=413961925"
  echo ""
else
  echo "3. 测试参数验证（无token）"
  echo ""
  
  echo "3.1 搜索接口缺少关键字："
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${API_URL}/vessel/search"
  echo ""
  
  echo "3.2 详情接口缺少MMSI："
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${API_URL}/vessel/position"
  echo ""
  
  echo "3.3 错误的MMSI格式："
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${API_URL}/vessel/position?mmsi=123"
  echo ""
fi

echo "========================================="
echo "测试完成"
echo ""
echo "使用方法："
echo "  ./test-vessel-api.sh [JWT_TOKEN]"
echo ""
echo "示例："
echo "  ./test-vessel-api.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
echo ""
