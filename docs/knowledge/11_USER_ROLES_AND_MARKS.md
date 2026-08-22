# 用户管理体系与多唛头关联业务规范

> 本规范定义系统统一用户体系、四类系统角色职责边界、普通用户多唛头（`shippingMarks`）数据隔离模型及界面交互准则。

---

## 🏛️ 一、 核心架构定位

在 Global Link Logistics 系统中，**用户系统管理（账号管理）** 与 **客户业务档案（Customer）** 严格解耦：

```mermaid
graph TD
    subgraph 用户系统管理 (User Management)
        U1[管理员 ADMIN]
        U2[业务员 SALES]
        U3[财务 FINANCE]
        U4[普通用户 USER]
    end

    subgraph 客户档案与唛头池 (Customer Pool)
        C1["客户A (主唛头: WH-ZZY-FLB)"]
        C2["客户A (子唛头: WH-10115)"]
        C3["客户B (唛头: GZ-688)"]
    end

    U1 -->|全局管理权限| System[系统全功能与配置]
    U2 -->|业务调度权限| Workbench[入库/运单调度/集装箱]
    U3 -->|核算审批权限| Finance[费用结算/销账对账]
    U4 -.->|绑定唛头数组 shippingMarks| C1
    U4 -.->|绑定唛头数组 shippingMarks| C2
```

1. **用户表 (`User`)**：负责系统鉴权认证与操作权限控制，为每一个实际登录系统的自然人（员工或客户代表）分配独立账号。
2. **客户档案 (`Customer`)**：负责维护物流业务侧的委托人实体、默认起运仓、目的港、常用国内送货地址与海外收件人地址簿。
3. **多唛头关联 (`shippingMarks`)**：通过在 `User` 表中配置 `shippingMarks: String[]` 文本数组，实现一个客户登录账号与多个业务唛头的灵活归属。

---

## 👥 二、 四大系统角色定位与权限矩阵

| 角色代码 | 中文名称 | 人员定位 | 是否关联唛头 | 核心操作与功能权限 |
| :--- | :--- | :--- | :---: | :--- |
| `ADMIN` | **管理员** | 公司管理层 / IT 负责人 | ❌ 否 | 拥有系统全量功能，包括用户账号增删改查、全局字典与通道配置。 |
| `SALES` | **业务员** | 业务经办人 / 仓库调度员 | ❌ 否 | 入库拼箱工作台、运单全景调度、集装箱整柜跟踪、客户档案维护。 |
| `FINANCE` | **财务** | 财务会计 / 账单对账员 | ❌ 否 | 运单应收应付核算、整柜干线成本录入、收款销账与对账报表。 |
| `USER` | **普通用户** | 外部货主 / 委托企业跟单 |  **是 (必选1~N个)** | 仅能查看自身关联唛头名下的运单、装箱进度、物流轨迹与账单凭据。 |

---

## 🏷️ 三、 普通用户多唛头关联与数据隔离机制

### 1. 数据存储标准 (Prisma Model)
```prisma
model User {
  id            String       @id @default(uuid())
  phone         String       @unique             // 登录手机号 (主账号唯一键)
  name          String                           // 用户姓名 / 客户企业称呼
  passwordHash  String                           // BCrypt 密文哈希
  userRole      UserRoleEnum @default(USER)       // ADMIN | SALES | FINANCE | USER
  
  // 核心字段：关联客户唛头列表 (PostgreSQL 原生字符串数组)
  shippingMarks String[]     @default([])        // 如: ["WH-ZZY-FLB", "WH-10115", "GZ-688"]
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?
}

enum UserRoleEnum {
  ADMIN
  SALES
  FINANCE
  USER
}
```

### 2. 字段精简原则
- **彻底移除不必要字段**：剔除 `email`（邮箱）与 `company`（公司）字段。客户公司名称与联络信息统一在 `Customer`（客户档案）中维护，系统登录账号只保留纯粹的认证与权限信息。

### 3. 数据权限隔离算法
在所有涉及运单 (`Waybill` / `QuickOrder`)、拼箱包裹 (`WaybillItem`) 与货物轨迹查询的接口中，执行统一的数据拦截规则：

```typescript
// 鉴权中间件解析当前登录用户 currentUser
if (currentUser.userRole === 'USER') {
  const allowedMarks = currentUser.shippingMarks || [];
  
  // 1. 无唛头保护：如果普通用户未绑定任何有效唛头，直接返回空结果集
  if (allowedMarks.length === 0) {
    return reply.send({ success: true, data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } });
  }

  // 2. 多唛头 IN 过滤：运单上的 userMark 属于用户拥有的任意一个唛头即放行
  where.userMark = {
    in: allowedMarks,
  };
}
// 管理员(ADMIN)、业务员(SALES)、财务(FINANCE) 不受 shippingMarks 限制，具备全量或岗位视角
```

---

## 🖥️ 四、 界面交互规范与表单联动准则

### 1. 用户管理列表 (`/user-management`)
- **表格列规范**：
  1. `用户姓名`
  2. `登录手机号`
  3. `系统角色`（采用色彩徽章区分：🔴 管理员 / 🔵 业务员 / 🟡 财务 / 🟢 普通用户）
  4. `关联唛头`（普通用户渲染为深浅适宜的 Tag 标签云；内部员工统一显示 `-`）
  5. `创建时间`
  6. `操作`（编辑 / 删除）

### 2. 新增与编辑弹窗表单联动
- **录入项**：
  - `姓名 *`
  - `登录手机号 *`
  - `登录密码`（新增必填，编辑留空表示不修改）
  - `系统角色 *`（下拉单选：管理员 / 业务员 / 财务 / 普通用户）
- **联动逻辑**：
  - 当选中 `普通用户` 时，动态展开「**关联客户唛头**」标签选择器：
    - 支持从已有客户档案（`Customer`）中快捷点击多选；
    - 支持手动输入自定义唛头编码，按回车添加；
    - 允许随时点击 `✕` 删除已绑定的唛头。
  - 当选中 `管理员 / 业务员 / 财务` 时，自动收起并清空唛头录入项。
