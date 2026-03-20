# Global Link Logistics System

国际物流系统 - 包含客户门户、管理后台及实时追踪功能

## 🎯 系统架构

```
├── frontend/
│   ├── customer/          # 客户门户 (React + Vite + Shadcn/ui)
│   └── admin/             # 管理后台 (Vue3 + Vben Admin)
├── backend/               # 后端API (Node.js + Fastify + Prisma)
├── docker-compose.yml     # Docker编排配置
└── README.md
```

## 🚀 技术栈

### 前端
- **客户门户**: React 18 + TypeScript + Vite + Shadcn/ui + CesiumJS + Mapbox
- **管理后台**: Vue3 + Vben Admin + Ant Design Vue + ECharts

### 后端
- **框架**: Node.js + Fastify + TypeScript
- **ORM**: Prisma
- **数据库**: PostgreSQL 16
- **缓存**: Redis 7
- **实时通信**: Socket.io

### 核心功能
- 🌍 3D地球物流可视化 (CesiumJS)
- 📦 实时包裹追踪 (AfterShip/17TRACK API)
- 💳 多币种支付 (Stripe)
- 🔐 AES-256-GCM数据加密
- 👥 RBAC权限控制 (Casbin)
- 📊 Excel批量导入 (SheetJS)

## 📦 快速开始

### 前置要求
- Docker & Docker Compose
- Node.js 18+ (本地开发)
- Git

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd global-link-logistics
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 填入你的API密钥
```

3. **启动开发环境**
```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

4. **初始化数据库**
```bash
# 进入后端容器
docker-compose exec backend sh

# 运行数据库迁移
npx prisma migrate dev

# 生成Prisma Client
npx prisma generate

# 退出容器
exit
```

5. **访问应用**
- 客户门户: http://localhost:5173
- 管理后台: http://localhost:5174
- 后端API: http://localhost:3000
- API文档: http://localhost:3000/docs

## 🛠️ 本地开发（不使用Docker）

### 后端开发
```bash
cd backend
npm install
cp .env.example .env
# 确保PostgreSQL和Redis在运行
npx prisma migrate dev
npm run dev
```

### 客户门户开发
```bash
cd frontend/customer
npm install
npm run dev
```

### 管理后台开发
```bash
cd frontend/admin
npm install
npm run dev
```

## 🎨 品牌配色

```css
--primary-dark: #0A2540;      /* 深空背景 */
--primary-blue: #5167FC;       /* 亮蓝主色 */
--accent-cyan: #00B6FF;        /* 霓虹青 */
--accent-coral: #FF6B6B;       /* 珊瑚橙 */
```

## 📚 API文档

启动后端服务后访问 `http://localhost:3000/docs` 查看自动生成的API文档

## 🔒 安全说明

- 所有敏感数据使用AES-256-GCM加密存储
- JWT Token用于身份认证
- RBAC权限控制所有API端点
- Stripe支付符合PCI-DSS标准
- 环境变量不提交到Git仓库

## 📝 开发进度

- [x] 项目初始化
- [x] 后端API基础框架（100%）
- [x] 客户门户前端（100% - 所有订单管理页面已完成）
  - [x] 首页（3D地球 + 查询）
  - [x] 登录/注册
  - [x] 物流追踪（含Mapbox 2D地图）
  - [x] 订单列表
  - [x] 创建订单（多步骤表单）
  - [x] 订单详情
  - [x] 支付页面（Stripe集成）
- [ ] 管理后台前端（待开始）
- [x] 物流追踪核心功能（100%）
- [x] 订单管理模块（100%）
- [x] 支付集成（Stripe Payment Element）
- [ ] 权限系统（RBAC待实现）
- [ ] Logo设计（待创建）
- [ ] 生产环境部署配置（待优化）

## 🤝 贡献指南

暂不对外开放

## 📄 许可证

Private & Confidential
