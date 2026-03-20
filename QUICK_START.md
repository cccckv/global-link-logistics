# 快速启动指南

本指南将帮助您在5分钟内启动 Global Link Logistics 系统。

## 📋 前置要求

- Docker 和 Docker Compose（已安装）
- Node.js 18+（已安装）
- 终端/命令行工具

## 🚀 快速启动（5分钟）

### 步骤 1: 获取必要的API Token

在启动项目前，您需要获取以下免费API Token：

#### 1.1 Cesium Ion Token（3D地球）
1. 访问 https://ion.cesium.com/signup
2. 注册免费账户
3. 前往 https://ion.cesium.com/tokens
4. 复制您的 **Default Token**

#### 1.2 Mapbox Token（2D地图）
1. 访问 https://account.mapbox.com/auth/signup/
2. 注册免费账户
3. 前往 https://account.mapbox.com/access-tokens/
4. 复制您的 **Default public token**

#### 1.3 Stripe Test Keys（支付功能）
1. 访问 https://dashboard.stripe.com/register
2. 注册账户
3. 切��到 **测试模式**（左上角开关）
4. 前往 https://dashboard.stripe.com/test/apikeys
5. 复制：
   - **Publishable key** (以 `pk_test_` 开头)
   - **Secret key** (以 `sk_test_` 开头，点击"Reveal"显示)

### 步骤 2: 配置环境变量

#### 2.1 后端环境变量

创建 `backend/.env` 文件：

```bash
cd /tmp/www/global-link-logistics/backend
cp .env.example .env
```

编辑 `backend/.env`，填入以下内容：

```env
DATABASE_URL="postgresql://logistics:password@localhost:5432/globallink"
REDIS_URL="redis://localhost:6379"

JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# AES-256 加密密钥（64位十六进制字符串）
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Stripe 密钥（从步骤1.3获取）
STRIPE_SECRET_KEY="sk_test_YOUR_STRIPE_SECRET_KEY"
STRIPE_WEBHOOK_SECRET=""

PORT=3000
```

#### 2.2 前端环境变量

创建 `frontend/customer/.env` 文件：

```bash
cd /tmp/www/global-link-logistics/frontend/customer
cp .env.example .env
```

编辑 `frontend/customer/.env`，填入以下内容：

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000

# 从步骤1.1获取
VITE_CESIUM_ION_TOKEN=YOUR_CESIUM_TOKEN_HERE

# 从步骤1.2获取
VITE_MAPBOX_TOKEN=YOUR_MAPBOX_TOKEN_HERE

# 从步骤1.3获取（Publishable key）
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY
```

### 步骤 3: 启动数据库和缓存

```bash
cd /tmp/www/global-link-logistics

# 启动 PostgreSQL 和 Redis
docker-compose up -d db cache

# 等待数据库启动（约10秒）
sleep 10
```

### 步骤 4: 初始化后端

```bash
cd /tmp/www/global-link-logistics/backend

# 安装依赖
npm install

# 运行数据库迁移
npx prisma migrate dev --name init

# 生成 Prisma Client
npx prisma generate

# 启动后端服务
npm run dev
```

后端现在运行在 `http://localhost:3000`

### 步骤 5: 启动客户门户（新终端窗口）

打开新的终端窗口：

```bash
cd /tmp/www/global-link-logistics/frontend/customer

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

客户门户现在运行在 `http://localhost:5173`

## 🎉 完成！访问应用

打开浏览器访问：
- **客户门户**: http://localhost:5173
- **后端API**: http://localhost:3000

## 🧪 测试功能

### 1. 注册新用户
1. 访问 http://localhost:5173/register
2. 填写表单：
   - 邮箱：test@example.com
   - 密码：password123
   - 姓名：测试用户
3. 点击"注册"

### 2. 创建订单
1. 登录后，点击"下单"或访问 `/order/new`
2. 填写发件人信息（随意填写）
3. 填写收件人信息（注意填写国家/地区）
4. 选择货物重量和运输方式
5. 查看预估价格
6. 点击"创建订单并支付"

### 3. 测试支付（Stripe测试模式）
在支付页面使用以下测试卡号：

**成功支付**:
- 卡号: `4242 4242 4242 4242`
- 过期日期: 任意未来日期（如 `12/34`）
- CVC: 任意3位数（如 `123`）
- 邮编: 任意5位数（如 `12345`）

**失败支付**:
- 卡号: `4000 0000 0000 0002`

更多测试卡号：https://stripe.com/docs/testing#cards

### 4. 查询物流
1. 点击"物流追踪"或访问 `/tracking`
2. 输入运单号查询（注：演示环境没有真实运单，需要管理员添加）

## 🛑 停止服务

### 停止前端
在前端终端窗口按 `Ctrl+C`

### 停止后端
在后端终端窗口按 `Ctrl+C`

### 停止数据库
```bash
cd /tmp/www/global-link-logistics
docker-compose down
```

## 🔧 常见问题

### Q1: 数据库连接失败
**错误**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**解决方法**:
```bash
# 检查数据库是否运行
docker-compose ps

# 如果未运行，启动它
docker-compose up -d db

# 查看数据库日志
docker-compose logs db
```

### Q2: 端口已被占用
**错误**: `Port 3000 is already in use`

**解决方法**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或者修改端口
# 在 backend/.env 中修改 PORT=3001
# 在 frontend/customer/.env 中修改 VITE_API_BASE_URL=http://localhost:3001
```

### Q3: npm install 失败
**错误**: `ERESOLVE unable to resolve dependency tree`

**解决方法**:
```bash
# 使用 --legacy-peer-deps 标志
npm install --legacy-peer-deps

# 或者清除缓存
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Q4: Prisma 迁移失败
**错误**: `Migration failed`

**解决方法**:
```bash
# 重置数据库
npx prisma migrate reset

# 重新运行迁移
npx prisma migrate dev
```

### Q5: 3D地球不显示
**可能原因**: Cesium Token未配置或无效

**解决方法**:
1. 检查 `frontend/customer/.env` 中 `VITE_CESIUM_ION_TOKEN` 是否正确
2. 打开浏览器控制台查看错误信息
3. 确认Token在 https://ion.cesium.com/tokens 中有效

### Q6: Mapbox地图不显示
**可能原因**: Mapbox Token未配置或无效

**解决方法**:
1. 检查 `frontend/customer/.env` 中 `VITE_MAPBOX_TOKEN` 是否正确
2. 确认Token在 https://account.mapbox.com/access-tokens/ 中有效
3. 检查Token的作用域包含 `styles:tiles` 和 `styles:read`

## 📚 下一步

- 📖 阅读 [PROJECT_STATUS.md](./PROJECT_STATUS.md) 了解完整功能列表
- 🔨 查看 [README.md](./README.md) 了解架构详情
- 🐛 报告问题或请求功能

## 💡 提示

### 开发技巧
1. **热重载**: 前端和后端都支持热重载，修改代码后自动刷新
2. **数据库查看**: 运行 `npx prisma studio` 在浏览器中查看数据库
3. **API测试**: 使用 Postman 或 cURL 测试后端API
4. **日志查看**: 
   - 后端日志：终端输出
   - 前端日志：浏览器控制台
   - 数据库日志：`docker-compose logs -f db`

### 性能优化
1. 如果开发机性能不足，可以关闭3D地球：
   - 编辑 `frontend/customer/src/pages/Home.tsx`
   - 注释掉 `<Globe3D />` 组件

2. 减少Socket.io日志：
   - 编辑 `backend/src/app.ts`
   - 修改Socket.io配置添加 `{ transports: ['websocket'] }`

---

**祝您使用愉快！** 🚀

如有问题，请查看日志或联系开发团队。
