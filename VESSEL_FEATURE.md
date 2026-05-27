# 船舶位置查询功能文档

## 功能概述
通过对接船讯网（Shipxy）API，实现实时查询船舶位置、航速、航向等信息。

## 技术实现

### 后端 (Backend)

#### 1. 环境变量配置
在 `.env` 中添加：
```bash
SHIPXY_API_KEY="93c6e46f08be420f98384eada73a9acb"
SHIPXY_BASE_URL="https://api.shipxy.com/apicall/v3"
```

#### 2. 模块结构
```
backend/src/modules/vessel/
├── service.ts       # 船讯网API调用服务
└── routes.ts        # Fastify路由处理
```

#### 3. API接口

##### 3.1 搜索船舶 (新增)
**Endpoint**: `GET /api/vessel/search`

**鉴权**: 需要 JWT Token

**请求参数**:
```typescript
{
  keywords: string;   // 查询关键字（船名/呼号/MMSI/IMO）
  max?: number;       // 最大返回数量（1-100，默认10）
}
```

**响应示例**:
```json
{
  "success": true,
  "total": 2,
  "data": [
    {
      "matchType": 5,
      "mmsi": 212759000,
      "imo": 9363132,
      "callSign": "5BSD6",
      "shipName": "IOLE R",
      "dataSource": 0,
      "lastTime": "2025-09-17 10:09:44",
      "lastTimeUtc": 1758074984
    }
  ]
}
```

**匹配类型 (matchType)**:
- `1`: 船名匹配
- `2`: 呼号匹配
- `3`: MMSI匹配
- `5`: IMO匹配

##### 3.2 获取船舶详细位置
**Endpoint**: `GET /api/vessel/position`

**鉴权**: 需要 JWT Token

**请求参数**:
```typescript
{
  mmsi: string;       // MMSI编号（9位数字，必填）
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "mmsi": 413961925,
    "imo": 0,
    "callSign": "P",
    "shipName": "WANHONGYUAN369",
    "shipCnName": "皖鸿远369",
    "shipType": 70,
    "length": 68,
    "width": 13,
    "draught": 4.8,
    "destination": "TAIZHOU,CN",
    "destinationCode": "CNTZO",
    "eta": "2025-03-31 02:09:00",
    "lat": 32.192517,
    "lng": 119.628093,
    "sog": 6.2,
    "cog": 80.8,
    "heading": 511,
    "rot": 0,
    "lastTime": "2025-04-28 16:05:48",
    "lastTimeUtc": 1745827548
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "VESSEL_NOT_FOUND",
  "message": "未找到该船舶信息"
}
```

**错误码**:
- `MISSING_KEYWORDS`: 缺少查询关键字（搜索接口）
- `MISSING_MMSI`: 缺少MMSI参数（详情接口）
- `INVALID_MMSI`: MMSI格式错误（应为9位数字）
- `VESSEL_NOT_FOUND`: 未找到船舶信息
- `RATE_LIMIT`: API请求频率超限
- `TIMEOUT`: 请求超时
- `INTERNAL_ERROR`: 服务器内部错误

#### 4. 服务层功能
- API Key 安全管理（仅后端持有）
- 10秒超时保护
- 错误码映射与友好提示
- 数据格式标准化（下划线转驼峰）

---

### 前端 (Frontend)

#### 1. 页面路径
`/vessel-position`（需登录）

#### 2. 文件结构
```
frontend/customer/src/
├── pages/VesselPosition.tsx    # 船舶位置查询页面
└── lib/api.ts                  # API封装（新增 vesselApi）
```

#### 3. 功能特性
- **搜索表单**: 
  - 关键字输入（支持船名、呼号、MMSI、IMO）
  - 自动匹配识别（9位数字=MMSI，7位数字=IMO）
  - 实时校验与错误提示

- **搜索结果列表**:
  - 显示匹配船舶列表（最多20条）
  - 显示匹配类型标签（船名/呼号/MMSI/IMO）
  - 显示基本信息（MMSI、IMO、呼号）
  - 显示最后更新时间
  - 点击任一结果查看详细位置

- **船舶详细信息卡片**:
  - 基本信息：船名、中文船名、MMSI、IMO、呼号、船舶类型
  - 航行信息：经纬度、航速(SOG)、航向(COG)、船首向(Heading)
  - 目的地信息：目的港、预计到达时间(ETA)
  - 船舶参数：船长、船宽、吃水
  - 最后更新时间

- **地图展示**:
  - 使用 Leaflet + OpenStreetMap
  - 船舶当前位置 Marker
  - Popup 显示关键信息

- **状态管理**:
  - Loading 状态
  - Error 提示
  - Empty 状态

#### 4. UI/UX
- 深蓝色太空主题（与项目风格一致）
- 渐变色按钮（#5167FC → #00B6FF）
- 卡片式布局（毛玻璃效果）
- 响应式设计（左右分栏：信息卡 + 地图）

---

## 部署与测试

### 1. 启动服务
```bash
# 后端
cd backend
npm run dev

# 前端
cd frontend/customer
npm run dev
```

### 2. 测试流程
```bash
# 1. 登录获取token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"your-phone","password":"your-password"}'

# 2. 搜索船舶（新接口）
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/vessel/search?keywords=cosco&max=10"

# 3. 获取详细位置
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/vessel/position?mmsi=413961925"
```

### 3. 前端访问
1. 访问 `http://localhost:5173/vessel-position`
2. 输入关键字：
   - 船名示例: `cosco`
   - MMSI示例: `413961925`
   - IMO示例: `9363132`
3. 点击搜索 → 选择船舶 → 查看详细位置与地图

---

## 安全注意事项

⚠️ **重要**：你之前公开的 API Key 已泄露，建议立即在船讯网后台重置。

### 安全措施
1. API Key 仅存储在后端环境变量
2. 前端不可见 Key（仅调用内部接口）
3. 所有请求需 JWT 认证
4. 超时与限流保护

---

## 扩展计划

### 近期
- [x] 支持 IMO 查询（已完成）
- [x] 支持船名模糊查询（已完成）
- [x] 支持呼号查询（已完成）
- [ ] 添加查询历史记录
- [ ] 接入缓存（Redis）减少上游调用
- [ ] 搜索结果分页（当前最多20条）

### 远期
- [ ] 船舶轨迹回放
- [ ] 多船舶批量查询
- [ ] 航线预测
- [ ] 到港提醒（WebSocket推送）

---

## API文档参考
船讯网API文档: https://my.feishu.cn/wiki/GxF2w6cZHisQiEkBRatcoIqlnfc

### 当前对接接口
- **SearchShip**: 船舶搜索（主接口）
  - Endpoint: `GET /SearchShip`
  - Params: `key`, `keywords`, `max`
  - 支持：船名、呼号、MMSI、IMO
  - Status Code: `0` = 成功

- **GetSingleShip**: 单船详细位置查询
  - Endpoint: `GET /GetSingleShip`
  - Params: `key`, `mmsi`
  - 返回完整船舶信息（含经纬度、航速、航向等）
  - Status Code: `0` = 成功

---

## 开发者
- 实现日期: 2026-04-28
- 状态: ✅ 已完成
