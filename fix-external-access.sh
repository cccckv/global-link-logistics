#!/bin/bash

echo "🔧 修复外部访问配置"
echo "===================="
echo ""

echo "1️⃣ 检查防火墙状态..."
if command -v ufw &> /dev/null; then
    echo "   检测到 UFW 防火墙"
    sudo ufw status | grep -E "5173|3000"
    
    echo ""
    echo "   是否需要开放端口? (y/n)"
    read -p "   > " open_ports
    
    if [ "$open_ports" = "y" ]; then
        echo "   正在开放端口..."
        sudo ufw allow 5173/tcp
        sudo ufw allow 3000/tcp
        echo "   ✅ 端口已开放"
    fi
elif command -v firewall-cmd &> /dev/null; then
    echo "   检测到 firewalld 防火墙"
    sudo firewall-cmd --list-ports | grep -E "5173|3000"
    
    echo ""
    echo "   是否需要开放端口? (y/n)"
    read -p "   > " open_ports
    
    if [ "$open_ports" = "y" ]; then
        echo "   正在开放端口..."
        sudo firewall-cmd --permanent --add-port=5173/tcp
        sudo firewall-cmd --permanent --add-port=3000/tcp
        sudo firewall-cmd --reload
        echo "   ✅ 端口已开放"
    fi
else
    echo "   ⚠️  未检测到常见防火墙（UFW/firewalld）"
    echo "   请手动检查防火墙配置"
fi

echo ""
echo "2️⃣ 检查端口监听状态..."
if command -v netstat &> /dev/null; then
    netstat -tuln | grep -E "5173|3000"
elif command -v ss &> /dev/null; then
    ss -tuln | grep -E "5173|3000"
else
    echo "   ⚠️  netstat/ss 命令不可用"
fi

echo ""
echo "3️⃣ 检查 Vite 配置..."
if grep -q "host: '0.0.0.0'" /tmp/www/global-link-logistics/frontend/customer/vite.config.ts; then
    echo "   ✅ Vite 已配置监听 0.0.0.0"
else
    echo "   ❌ Vite 配置需要更新"
fi

echo ""
echo "4️⃣ 获取服务器IP地址..."
echo "   内网IP:"
ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print "      " $2}'

if command -v curl &> /dev/null; then
    echo ""
    echo "   外网IP:"
    external_ip=$(curl -s ifconfig.me)
    echo "      $external_ip"
fi

echo ""
echo "===================="
echo "✅ 配置检查完成"
echo ""
echo "📝 访问地址："
echo "   内网: http://<内网IP>:5173"
if [ -n "$external_ip" ]; then
    echo "   外网: http://$external_ip:5173"
fi
echo ""
echo "⚠️  如果仍无法访问，请检查："
echo "   1. 云服务器安全组规则（阿里云/腾讯云/AWS等）"
echo "   2. 确保前端服务正在运行: npm run dev"
echo "   3. 检查后端 CORS 配置是否允许您的IP"
echo ""
