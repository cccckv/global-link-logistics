# 外部访问配置指南

## 问题：5173端口无法外部访问

这个问题通常由以下原因导致：

## ✅ 已完成的配置

我已经更新了以下配置以支持外部访问：

### 1. 前端 Vite 配置
**文件**: `frontend/customer/vite.config.ts`

```typescript
server: {
  host: '0.0.0.0',  // ✅ 监听所有网络接口
  port: 5173,
  strictPort: false,
}
```

### 2. 后端服务配置
**文件**: `backend/src/app.ts`

```typescript
const host = process.env.BACKEND_HOST || '0.0.0.0';  // ✅ 监听所有网络接口
await fastify.listen({ port, host });
```

## 🔧 需要您手动检查的配置

### 步骤 1: 检查防火墙

#### Ubuntu/Debian (UFW)
```bash
# 检查防火墙状态
sudo ufw status

# 开放必要端口
sudo ufw allow 5173/tcp  # 前端
sudo ufw allow 3000/tcp  # 后端

# 重新加载防火墙
sudo ufw reload
```

#### CentOS/RHEL (firewalld)
```bash
# 检查防火墙状态
sudo firewall-cmd --list-ports

# 开放必要端口
sudo firewall-cmd --permanent --add-port=5173/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp

# 重新加载防火墙
sudo firewall-cmd --reload
```

#### 使用 iptables
```bash
# 开放端口
sudo iptables -A INPUT -p tcp --dport 5173 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT

# 保存规则
sudo iptables-save > /etc/iptables/rules.v4
```

### 步骤 2: 检查云服务器安全组

如果您使用云服务器（阿里云、腾讯云、AWS、Azure等），需要在控制台配置安全组规则：

#### 阿里云 ECS
1. 登录 [ECS控制台](https://ecs.console.aliyun.com)
2. 进入"网络与安全" > "安全组"
3. 选择您的安全组 > "配置规则"
4. 添加入方向规则：
   - 协议类型: TCP
   - 端口范围: 5173/5173
   - 授权对象: 0.0.0.0/0（或您的IP）
5. 重复上述步骤添加 3000 端口

#### 腾讯云 CVM
1. 登录 [云服务器控制台](https://console.cloud.tencent.com/cvm)
2. 进入"安全组"
3. 选择安全组 > "添加规则"
4. 入站规则：
   - 类型: 自定义TCP
   - 端口: 5173, 3000
   - 来源: 0.0.0.0/0

#### AWS EC2
1. 登录 [EC2控制台](https://console.aws.amazon.com/ec2/)
2. 进入"Network & Security" > "Security Groups"
3. 选择安全组 > "Inbound rules" > "Edit inbound rules"
4. 添加规则：
   - Type: Custom TCP
   - Port range: 5173
   - Source: 0.0.0.0/0
5. 重复上述步骤添加 3000 端口

### 步骤 3: 配置后端 CORS

**文件**: `backend/.env`

```env
# 开发环境：允许所有来源（不推荐生产环境）
CORS_ORIGIN="*"

# 或者指定您的服务器IP/域名
CORS_ORIGIN="http://your-server-ip:5173,http://your-domain.com"
```

### 步骤 4: 重启服务

```bash
# 停止当前运行的服务（Ctrl+C）

# 后端
cd /tmp/www/global-link-logistics/backend
npm run dev

# 前端（新终端）
cd /tmp/www/global-link-logistics/frontend/customer
npm run dev
```

## 🧪 测试外部访问

### 1. 获取服务器IP

```bash
# 获取内网IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# 获取外网IP
curl ifconfig.me
```

### 2. 从本地浏览器访问

```
http://<服务器外网IP>:5173
```

### 3. 测试后端API

```bash
# 从本地电脑执行
curl http://<服务器外网IP>:3000/health
```

应该返回：
```json
{"status":"ok","timestamp":"2026-03-20T..."}
```

## 🛠️ 快速诊断脚本

运行诊断脚本（我已创建）：

```bash
cd /tmp/www/global-link-logistics
chmod +x fix-external-access.sh
./fix-external-access.sh
```

## 🔍 常见问题排查

### 问题1: 端口未监听

**检查方法**:
```bash
# 检查端口是否在监听
netstat -tuln | grep -E "5173|3000"
# 或
ss -tuln | grep -E "5173|3000"
```

**预期输出**:
```
tcp   0   0   0.0.0.0:5173   0.0.0.0:*   LISTEN
tcp   0   0   0.0.0.0:3000   0.0.0.0:*   LISTEN
```

**解决方法**: 确保服务正在运行

### 问题2: 监听在 127.0.0.1 而非 0.0.0.0

**错误输出**:
```
tcp   0   0   127.0.0.1:5173   0.0.0.0:*   LISTEN  # ❌ 只监听本地
```

**解决方法**: 检查 vite.config.ts 配置是否正确

### 问题3: 防火墙阻止

**检查方法**:
```bash
# 尝试从服务器本地访问
curl http://localhost:5173

# 从外部访问
curl http://<外网IP>:5173
```

如果本地访问成功但外部失败，则是防火墙问题

### 问题4: CORS 错误

**浏览器控制台错误**:
```
Access to XMLHttpRequest at 'http://server-ip:3000/api/...' 
from origin 'http://server-ip:5173' has been blocked by CORS policy
```

**解决方法**:
```bash
# 编辑 backend/.env
CORS_ORIGIN="*"  # 或指定您的IP

# 重启后端服务
```

### 问题5: Socket.io 连接失败

**浏览器控制台错误**:
```
WebSocket connection to 'ws://server-ip:3000/socket.io/' failed
```

**解决方法**:
1. 确保后端 Socket.io CORS 配置正确
2. 检查前端 `.env` 中的 `VITE_SOCKET_URL`
3. 某些云服务器需要单独开放 WebSocket 端口

## 📋 完整检查清单

- [ ] Vite 配置 `host: '0.0.0.0'` ✅（已完成）
- [ ] 后端配置 `host: '0.0.0.0'` ✅（已完成）
- [ ] 系统防火墙开放 5173 和 3000 端口
- [ ] 云服务器安全组开放端口
- [ ] 后端 CORS 配置允许您的IP
- [ ] 服务正在运行且监听 0.0.0.0
- [ ] 测试从外部访问成功

## 🚀 推荐配置（开发环境）

### backend/.env
```env
DATABASE_URL="postgresql://logistics:password@localhost:5432/globallink"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-jwt-secret"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
BACKEND_PORT=3000
BACKEND_HOST="0.0.0.0"
CORS_ORIGIN="*"  # 开发环境允许所有来源
LOG_LEVEL="info"
```

### frontend/customer/.env
```env
# 使用服务器外网IP
VITE_API_BASE_URL=http://<服务器外网IP>:3000
VITE_SOCKET_URL=http://<服务器外网IP>:3000

VITE_CESIUM_ION_TOKEN=your_token
VITE_MAPBOX_TOKEN=your_token
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

## ⚠️ 生产环境注意事项

在生产环境中，请：

1. **使用 Nginx 反向代理** 而非直接暴露端口
2. **配置 HTTPS/SSL**
3. **限制 CORS 来源** 为您的域名
4. **使用环境变量** 而非硬编码IP
5. **配置防火墙规则** 限制来源IP
6. **启用速率限制** 防止DDoS

示例 Nginx 配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

---

**如果按照上述步骤操作后仍无法访问，请提供以下信息**：

1. 服务器操作系统和版本
2. 是否使用云服务器（阿里云/腾讯云/AWS等）
3. `netstat -tuln | grep 5173` 的输出
4. `sudo ufw status` 或 `sudo firewall-cmd --list-ports` 的输出
5. 浏览器控制台的错误信息
