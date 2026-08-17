# Global Link Logistics - Agent Guidelines

## 核心行为与交互准则 (Behavioral Guidelines)

### 1. 严格遵守讨论与提问模式 (Discussion & Q&A Mode)
- **禁止提前直接修改代码**：当用户提出“讨论”、“我们目前是在讨论”、“探讨一下”、“分析一下”或纯提问疑点时，**绝对不得主动修改任何源代码或执行写操作**。
- **职责范围**：在讨论/提问模式下，只能深入分析业务逻辑、梳理技术架构、比对数据字段并给出明确的对比方案与优缺点；
- **执行触发条件**：只有在用户明确确认并下达执行指令（例如“按照方案1”、“开始修改”、“提交”）后，方可对代码进行实际修改。

### 2. 物流计费体系黄金准则 (Pricing & Financial Standards)
- **散货拼箱 (SEA_LCL)**：按体积单价算方（元/方），总应收 = $\sum (\text{实测方数 } \text{m}^3 \times \text{应收体积单价}) + \sum \text{应收杂费}$；明细行记录 `receivableUnitPrice` / `payableUnitPrice`；
- **空运专线 (AIR)**：按重量单价计费（元/kg），总应收 = $\sum (\text{计费重量 } \text{kg} \times \text{应收重量单价}) + \sum \text{应收杂费}$；明细行记录重量单价；
- **海运整柜 (SEA_FCL)**：按整柜协议包干总报价核算，隐藏散货单价列与散货协商一口价复选框；干线硬成本按开船与清关节点在集装箱维度录入；
- **单票纯利润 (Profit)**：恒等于 $\text{总应收金额 (receivableAmount)} - \text{总应付成本 (payableAmount)}$。

### 3. 两段式计费生命周期与双轨数据模型 (Two-Stage Lifecycle & Dual-Track Model)
- **阶段 1 客户预报（草稿/待入库）**：货物尺寸/重量为客户填报的“预估数据”（存储于 `estimatedLength`, `estimatedWidth`, `estimatedHeight`, `estimatedWeight`, `estimatedVolume`），生成的金额为**「预估应收参考」**，支持业务员纠偏修改；
- **阶段 2 到仓实测（已入库及后续阶段）**：仓库实测长宽高与重量（存储于 `length`, `width`, `height`, `unitWeight`, `payableVolume`）为**「法定结算基准」**。只要录入或修改实测尺寸，后端必须**自动重算并直接覆盖持久化**运单主表的 `receivableAmount`、`payableAmount` 与 `profitAmount`；
- **包干一口价单 (isFixedPrice)**：基础应收锁定为协议总价，但总成本随实测尺寸/干线硬成本动态重新核算；
- **附加杂费 (Waybill Fees)**：无论在哪个流转阶段增删杂费，均实时触发主表财务总账动态累加/扣减。

### 4. 工程与后端规范 (Engineering Standards)
- **Prisma 分页与数值强转**：从 URL Query 接收的 `page` 和 `limit` 必须显式强制转换为整型（如 `Math.max(1, Number(query.limit) || 10)`），严禁将字符串直接传给 Prisma 的 `take` / `skip`；
- **前端除零容错保护**：核算体积/重量偏差比时，必须做好除零保护（如 `estVol > 0.00001`），严禁渲染 `undefined%` 或 `Infinity%`；
- **Git 分支管理准则**：严禁擅自合并至 `main` 主分支，所有重构和新特性必须保留在指定功能/重构分支（如 `refactor`）。

### 5. 集装箱整柜流转与完结校验准则 (Container Completion Standards)
- **全部完结强校验**：只有在集装箱名下装载的**所有拼箱运单状态均为「已签收完结」(DELIVERED)** 时，方允许将货柜状态标记为 **「全部完结」(COMPLETED)**；
- **未完结拦截与提示**：若柜内仍有未签收运单，前后端必须实施双重拦截，并精准列出未签收运单号及票数，禁止直接完结货柜。

