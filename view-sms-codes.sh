#!/bin/bash

# 查看短信验证码脚本
# 用途: 开发环境中查看后端日志中的验证码

echo "=========================================="
echo "📱 短信验证码查看工具"
echo "=========================================="
echo ""

if [ "$1" == "-f" ] || [ "$1" == "--follow" ]; then
  echo "👀 实时监控验证码 (Ctrl+C 退出)..."
  echo ""
  docker compose logs backend -f 2>&1 | grep --line-buffered "SMS"
else
  echo "📋 最近的验证码 (最近50条):"
  echo ""
  docker compose logs backend --tail 50 2>&1 | grep "SMS"
  
  if [ $? -ne 0 ]; then
    echo "❌ 未找到验证码记录"
    echo ""
    echo "提示: 请先发送验证码，或使用 -f 参数实时监控"
  fi
  
  echo ""
  echo "=========================================="
  echo "💡 使用方法:"
  echo "  ./view-sms-codes.sh           查看最近的验证码"
  echo "  ./view-sms-codes.sh -f        实时监控验证码"
  echo "=========================================="
fi
