# 业务与数据流转全景：订单全生命周期与数据表使用指南

> 本文档详细阐述一个国际物流订单从客户发起预报到最终海外签收完结的 6 个阶段，以及在每个阶段中各数据库表的读写、前后端交互与关联逻辑。

---

## 🗺️ 1. 全生命周期 6 阶段概览

```mermaid
sequenceDiagram
    autonumber
    actor 客户 as 客户 (Customer)
    actor 业务员 as 业务员/操作 (Operator)
    actor 仓库 as 国内集货仓 (Warehouse)
    actor 船司清关 as 船司/清关行 (Carrier/Customs)
    actor 海外派送 as 海外仓/司机 (Overseas)
    participant DB as 数据库 (PostgreSQL)

    rect rgb(240, 248, 255)
    Note over 客户, DB: 阶段一：客户委托与下单预报 (Drafting)
    客户->>业务员: 提供预报信息 (唛头、品名、件数、国内快递单号、收件人)
    业务员->>DB: 1. 读 Customer 档案 (回显起运仓/目的国/收件人)<br/>2. 写 Waybill (生成全局唯一 waybillNo, status: DRAFT)<br/>3. 写 WaybillItem (多行货物预报)
    DB->>业务员: 弹出“预报成功提示窗”，展示单号并支持一键复制
    end

    rect rgb(255, 250, 240)
    Note over 仓库, DB: 阶段二：仓库实测核量与计费 (Inbound & Measuring)
    仓库->>业务员: 包裹到仓，提供实测长宽高/重量、运递单号(expressNo)及叫车图
    业务员->>DB: 1. 改 Waybill (status: INBOUND, inboundDate, expressNo)<br/>2. 改 WaybillItem (实测尺寸, 自动算得应付/应收体积)<br/>3. 写 WaybillFee (主运费/成本)<br/>4. (选) 本地直选/拖拽上传叫车截图至 WaybillAttachment
    end

    rect rgb(240, 255, 240)
    Note over 仓库, DB: 阶段三：人工排柜与配载 (Container Stuffing)
    仓库->>业务员: 人工指定装入集装箱 (如广62柜/MILU6019768)、装柜日期
    业务员->>DB: 1. 查/写 ContainerMaster (柜号、港口、装柜时间)<br/>2. 改 Waybill (绑定 containerId, status: LOADED)
    end

    rect rgb(255, 245, 238)
    Note over 船司清关, DB: 阶段四：干线起运与在途跟踪 (Sailing In-Transit)
    船司清关->>业务员: 船舶开航，出具海运提单(blNumber)、船名航次(vesselVoyage)、订舱与拖车账单
    业务员->>DB: 1. 改 ContainerMaster (sailingDate, eta, blNumber, status: SAILING)<br/>2. 写 ContainerFee (订舱费USD、港杂、拖车)<br/>3. 批量联动名下 Waybill (status: IN_TRANSIT, voyageNumber)
    end

    rect rgb(245, 245, 255)
    Note over 船司清关, DB: 阶段五：目的港到港与海关清关 (Customs Clearance)
    船司清关->>业务员: 到港清关放行，反馈海关缴税水单、THC/堆存费
    业务员->>DB: 1. 改 ContainerMaster (clearanceDate, 航运天数, status: CUSTOMS->DISPATCHING)<br/>2. 写 ContainerFee (清关费、THC比索)<br/>3. 本地上传海关水单至 WaybillAttachment (CUSTOMS_SLIP)
    end

    rect rgb(235, 255, 235)
    Note over 海外派送, DB: 阶段六：海外拆箱派送与客户签收完结 (Delivery Completion)
    海外派送->>业务员: 货物送达客户并完成签字，回传签收单照片
    业务员->>DB: 1. 改 Waybill (signedDate, 锁定应收/应付/毛利, status: DELIVERED)<br/>2. 本地上传签收单照片至 WaybillAttachment (SIGN_IMAGE)
    end
```

---

## 📋 2. 各阶段数据库操作与交互详解

### 阶段一：客户预报 (Drafting)
- **入口页面**：[极速预报下单工作台 (/v2/inbound)](file:///d:/ccccc/projects/global-link-logistics/frontend/customer/src/pages/v2/InboundWorkbench.tsx)
- **交互规范**：
  1. **纯净留白**：输入框初始不带任何虚假数据；输入唛头（如 `WH-ZZY-FLB`）后，系统从 `Customer` 真实档案中回显起运仓、目的国、目的港口与默认收件人。
  2. **级联通道**：根据报关通道（`customsType`）自动联动筛选承运服务商（`forwarderChannel`）。
  3. **运单号提示与复制**：表单提交后，后端生成全局唯一 `waybillNo`（如 `LCL2608170001`），前端**弹出运单号成功提示窗口**，提供一键复制按钮及【进入详情推进】、【继续开下一单】快捷入口。
- **触碰的数据表**：
  - `Customer` & `CustomerAddress`（只读）
  - `Waybill`（新建 Insert，`status = DRAFT`）
  - `WaybillItem`（新建 Insert，多行货物明细）

### 阶段二：仓库到货实测 (Inbound & Measuring)
- **入口页面**：[运单全生命周期交互工作台 (/v2/waybills/:id)](file:///d:/ccccc/projects/global-link-logistics/frontend/customer/src/pages/v2/WaybillDetailView.tsx) ➔ 阶段 2 模态框
- **交互规范**：
  1. 录入实际到仓日期 `inboundDate` 与仓库反馈的 `expressNo`（运递单号/运单号）；
  2. 录入实测长宽高与重量，系统实时公式算方 $\text{件数}\times\text{长}\times\text{宽}\times\text{高}/10^6$，并自动计算应收/应付金额；
  3. **本地文件上传**：支持将仓库传回的送仓提货截图从本地直接拖拽上传保存（`LocalFileUpload` 组件）。
- **触碰的数据表**：
  - `Waybill`（更新 Update，`status = INBOUND`）
  - `WaybillItem`（更新 Update，长宽高、重量、实际体积）
  - `WaybillFee`（新建/更新，主运费与车费明细）
  - `WaybillAttachment`（可选新建，`attachmentType = PICKUP_SCREENSHOT`）

### 阶段三：人工排柜拼箱 (Container Stuffing)
- **交互规范**：
  1. 调度员在列表中勾选多票散货，一键批量指派至已有集装箱或新建货柜；
  2. 新建集装箱支持填入柜号 `containerNo`、起运港 `originPort`、装柜时间 `loadingDate`。
- **触碰的数据表**：
  - `ContainerMaster`（新建/查询 Insert/Select）
  - `Waybill`（更新 Update，赋值 `containerId`，`status = LOADED`）

### 阶段四：干线起运在途 (Sailing In-Transit)
- **交互规范**：
  1. 填入实际开船日 `sailingDate`（ETD）、预计到港 `eta`、船名航次 `vesselVoyage` 以及**海运提单号 `blNumber`**；
  2. 录入整柜全链路干线费用（订舱海运费 USD/RMB、港杂、头程拖车）；
  3. 系统自动将该集装箱名下所有散货运单同步为 `status = IN_TRANSIT`。
- **触碰的数据表**：
  - `ContainerMaster`（更新 Update，`status = SAILING`）
  - `ContainerFee`（新建 Insert，整柜干线费用）
  - `Waybill`（批量更新 Update，同步 `status = IN_TRANSIT`）

### 阶段五：目的港清关与送柜拆派 (Customs Clearance & Dest Drayage)
- **交互规范**：
  1. 填入清关放行时间 `clearanceDate`、海关查验状态 `inspectStatus`；
  2. **目的港送柜拖车信息录入 (强制必填)**：录入司机姓名 `driverName`、联系电话 `driverPhone`、车牌号码 `truckPlateNo`、订车时间 `truckingDate`、送达仓库时间 `destArrivedDate`（拼箱柜自动从集装箱已有数据继承预填，免重复录入）；
  3. 系统自动计算总航运耗时 `totalShippingDays = clearanceDate - loadingDate`；
  4. 录入目的港清关费、THC/堆存费（支持比索 PHP 计算）；
  5. **本地文件上传**：本地直选或拖拽上传海关缴税水单 PDF / 图片（`attachmentType = CUSTOMS_SLIP`）。
- **触碰的数据表**：
  - `ContainerMaster`（更新 Update，写入拖车 5 大字段与 `clearanceDate`，`status = DISPATCHING`）
  - `ContainerFee`（新建 Insert，清关与 THC 费用）
  - `WaybillAttachment`（新建 Insert，上传水单附件）
  - `Waybill`（批量/单票更新 Update，同步 `status = DISPATCHING`）

### 阶段六：海外派送与签收 (Delivery Completion)
- **交互规范**：
  1. 填入海外客户实际签收日期 `signedDate`；
  2. **本地文件上传**：本地上传海外司机回传的客户收货签字照片（`attachmentType = SIGN_IMAGE`）；
  3. 系统将运单流转至终态 `status = DELIVERED`，财务锁定纯毛利；
  4. **整柜自动完结联动**：若该运单挂载了集装箱，后端自动检测该柜内全部散货是否已 100% 签收。若是最后一笔签收，系统**自动将集装箱主表更新为 `status = COMPLETED`**；若后续有撤销签收回退，集装箱自动恢复为 `DISPATCHING`。
- **触碰的数据表**：
  - `Waybill`（更新 Update，`status = DELIVERED`，锁定利润总账）
  - `WaybillAttachment`（新建 Insert，上传签收照片）
  - `ContainerMaster`（自动更新 Update，若名下散货全签收则 `status = COMPLETED`）

---

## 📊 3. 核心表数据状态对照速查表

| 阶段名称 | 运单状态 (`Waybill.status`) | 集装箱状态 (`ContainerMaster.status`) | 核心操作的表 | 关键字段变动 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 客户预报** | `DRAFT` (草稿/预报) | (无) | `Customer`, `Waybill`, `WaybillItem` | 生成 `waybillNo`，回显档案，弹窗提示并复制单号 |
| **2. 到货实测** | `INBOUND` (已入库) | (无) | `Waybill`, `WaybillItem`, `WaybillFee`, `WaybillAttachment` | 录入实测尺寸长宽高，算得体积，填 `expressNo`，本地传叫车图 |
| **3. 人工排柜** | `LOADED` (已装柜) | `LOADING` (装柜中) | `ContainerMaster`, `Waybill` | 创建/选择柜号，散货批量赋值 `containerId` |
| **4. 干线在途** | `IN_TRANSIT` (在途中) | `SAILING` (航运中) | `ContainerMaster`, `ContainerFee`, `Waybill` | 填开船日(ETD)、ETA、提单号(`blNumber`)、船名航次、订舱费 |
| **5. 目的港清关** | `DISPATCHING` (拆派中) | `CUSTOMS` ➔ `DISPATCHING` | `ContainerMaster`, `ContainerFee`, `WaybillAttachment` | 清关时间、航运天数、清关费/THC(PHP)、本地传海关税单 |
| **6. 签收完结** | `DELIVERED` (已完结) | `COMPLETED` (已完结) | `Waybill`, `WaybillAttachment` | 填签收时间、本地传签收照片、锁定最终财务毛利 |

---

## ✈️ 4. 空运业务专属生命周期流转对照表 (方案 A：零迁移规范)

针对 `orderType === 'AIR'` 的空运业务，全景调度工作台将自动切换为专用的空运阶段视图：

| 空运阶段名称 | 状态代码 (`Waybill.status`) | 核心操作与表单控件 | 关键字段映射 (零迁移) | 业务规则与必填约束 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 客户预报** | `DRAFT` | 录入唛头、品名、国内送仓单号、预报件数、收件人 | `Waybill`, `WaybillItem` | 生成 `waybillNo` (如 `AWB2608170001`) |
| **2. 到仓实测** | `INBOUND` | 录入到仓日期、**实测重量 (`totalWeightKg`)**、单价、车费 | `Waybill.totalWeightKg`, `WaybillItem`, `WaybillFee` | 纯按 **kg** 算费，隐藏海运立方算方，自动计算应收/干线成本 |
| **3. 仓库发货** | `LOADED` | 录入发货日期、承运专线、**【发货运单号】**、发货备注 | `Waybill.loadingDate`, `forwarderChannel`, `expressNo` | **【发货运单号】强制必填**，彻底去除柜号、航班号等海运项 |
| **4. 到海外仓** | `IN_TRANSIT` | 录入到达海外仓时间、海外中转仓点备注 | `Waybill.clearanceDate` | 记录干线空运与双清完毕入海外分拨仓节点 |
| **5. 海外派送** | `DISPATCHING` | 录入派送方式（专车/本地快递/自提）、派送单号/司机信息 | `Waybill.status = DISPATCHING`, `Waybill.note` | 海外仓出库末端配送 |
| **6. 签收完结** | `DELIVERED` | 录入客户签收日期、上传签收单照片 (`SIGN_IMAGE`) | `Waybill.signedDate`, `WaybillAttachment` | 客户签收归档，锁定财务毛利 |

---

## 🚢 5. 海运整柜 (SEA_FCL) 业务专属生命周期流转对照表 (方案 A：零迁移规范)

针对 `orderType === 'SEA_FCL'` 的整柜业务，全景调度工作台将自动切换为专用的整柜阶段视图（**不经过国内集拼仓，起运点为国内起运港口**）：

| 整柜阶段名称 | 状态代码 (`Waybill.status`) | 核心操作与表单控件 | 关键字段映射 (零迁移) | 业务规则与必填约束 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 订舱委托** | `DRAFT` | 录入唛头、**国内起运港口 (`originPort`)** ➔ 目的港口、箱型规格、整柜报价 | `Waybill.originWarehouse`, `Waybill.userMark` | 起运点必须是起运港（如厦门港/南沙港），严禁使用始发仓 |
| **2. 产地装箱** | `INBOUND` | 拖车到厂装箱，**直接录入集装箱柜号**、封条号、品名、件数、毛重 | `ContainerMaster.containerNo`, `Waybill.loadingDate` | **阶段 2 直录柜号并绑定 1:1 集装箱**，隐藏长宽高算方 |
| **3. 进港报关** | `LOADED` | 拖车送重柜入码头堆场并完成报关 | `ContainerMaster.status = LOADING` | 确认重柜集港与报关放行，一键流转 |
| **4. 干线航运** | `IN_TRANSIT` | 班轮起运开航，录入提单号 (`blNumber`)、船名航次、ETD/ETA、海运订舱费 | `ContainerMaster.blNumber`, `ContainerFee` | 记录海运干线成本与在途跟踪 |
| **5. 目的港清关** | `DISPATCHING` | 抵港海外清关，录入放行时间、税单、THC/超堆费、码头送柜拖车费 | `ContainerMaster.clearanceDate`, `ContainerFee` | 记录目的港清关成本并提柜派送 |
| **6. 送达签收** | `DELIVERED` | 海外收件人拆箱收货，回传签收单照片 (`SIGN_IMAGE`)，还空箱完结 | `Waybill.signedDate`, `ContainerMaster.status = COMPLETED` | 锁定整柜利润：$\text{报价} - \sum\text{全链路成本}$ |

---

## 🔄 6. 全生命周期阶段回退与水位线截断 (Waterfall Truncation) 规范

为了杜绝跨阶段跳退时的脏数据残留以及货柜广播推进时的误伤，系统实施统一的**阶段水位线截断模型**与**分流回退策略**：

### 6.1 阶段水位线清空矩阵 (Waterfall Reset Matrix)
当运单回退到目标阶段 $N$ 时，系统自动将所有 $> N$ 阶段的字段一次性清空（`Reset to null`）：

| 目标回退阶段 | 运单目标状态 | 自动清空的大于目标阶段字段 (置空 null) | 货柜关联处理 (`containerId`) |
| :--- | :--- | :--- | :--- |
| **回退至 阶段 1 (客户委托)** | `DRAFT` | `inboundDate`, `loadingDate`, `sailingDate`, `clearanceDate`, `signedDate`, `expressNo`, `voyageNumber`, 签收单/水单附件，并清空实测尺寸/方数/重量 | 🔓 **单票立即解绑** (`containerId = null`) |
| **回退至 阶段 2 (已入库)** | `INBOUND` | `loadingDate`, `sailingDate`, `clearanceDate`, `signedDate`, `voyageNumber`, 签收单/水单附件（保留实测尺寸/方数/重量） | 🔓 **单票立即解绑** (`containerId = null`) |
| **回退至 阶段 3 (已装柜/发货)** | `LOADED` | `sailingDate`, `clearanceDate`, `signedDate`, `voyageNumber`, 签收单/水单附件 | 🚢 保持货柜绑定 |
| **回退至 阶段 4 (干线在途)** | `IN_TRANSIT` | `clearanceDate`, `signedDate`, 签收单/水单附件 | 🚢 保持货柜绑定 |
| **回退至 阶段 5 (目的港清关/派送)** | `DISPATCHING` | `signedDate`, 签收单附件 | 🚢 保持货柜绑定 |

### 6.2 回退影响范围分流规则
1. **回退至阶段 1 或阶段 2（单票掏箱作业）**：
   - 仅当前这 1 票运单回退并自动解绑货柜；
   - 货柜内其余在柜运单保持不变，货柜配载统计实时重算扣减；
2. **海运拼箱回退至阶段 3、4、5（货柜级公共事件）**：
   - 必须弹出强二次确认警告，告知业务员将全员广播回退；
   - 确认后，柜内处于更高阶段的所有运单与 `ContainerMaster` 自身同步回退至目标阶段。

---

## 🔒 7. 全生命周期「前置数据链刚性守卫」矩阵 (Completeness Gate Matrix)

为了杜绝因跳阶段操作导致到仓实测尺寸、实测重量、干线提单、清关放行及送柜拖车信息被悬空遗漏，系统实施**全入口防御性数据链刚性守卫**：

### 7.1 前端阶梯严格上锁铁律
1. **已完成阶段 (`idx < currentStageIdx`)**：展示为绿色完成态，支持点击打开弹窗查看和回溯修改历史快照；
2. **当前进行中阶段 (`idx === currentStageIdx`)**：展示为蓝色高亮进行中，为当前**唯一允许操作流转推进的阶段**；
3. **未来未解锁阶段 (`idx > currentStageIdx`)**：展示为灰色置灰态并附加锁头图标（🔒），**严禁点击打开操作弹窗**。系统强制阻断并提示：*“流程不可跳跃！当前处于【阶段 X】，请先按顺序完成当前阶段数据录入与流转。”*
4. **底部待办 Banner 纠偏**：Banner 按钮精准对应当前进行中阶段（`currentStageIdx + 1`），严禁跨级诱导操作未来阶段。

### 7.2 全生命周期「前置数据链刚性守卫」校验矩阵
在触发任何阶段向前流转推进（`advanceStatus = true`）时，系统实施刚性拦截：

| 推进的目标阶段 | 业务模式 | 触发推进时的【前置数据强校验】 | 缺失时的拦截提示文案 |
| :--- | :--- | :--- | :--- |
| **推进至 阶段 2 (实测/装箱)** | 全模式 | 必须具备阶段 1 客户委托基本信息（唛头、目的地） | “请先完善阶段 1 客户委托预报信息！” |
| **推进至 阶段 3 (装柜/发货)** | `SEA_LCL`<br>`SEA_FCL`<br>`AIR` | ① 拼箱：必须已有阶段 2 实测体积 (`payableVolume > 0`)；<br>② 整柜：必须已录入装箱清单并绑定柜号；<br>③ 空运：必须已有实测重量 (`totalWeightKg > 0`) 且录入【发货运单号 `expressNo`】 | “无法装柜/发货：当前运单尚未在阶段 2 完成实测核量，请先完善实测数据！” |
| **推进至 阶段 4 (干线在途)** | `SEA_LCL`<br>`SEA_FCL`<br>`AIR` | ① 海运：必须已绑定集装箱货柜 (`containerId` 有效)，必须录入实际开船日 (`sailingDate`)、船名航次与海运提单号；<br>② 空运：必须已有阶段 3 发货运单号 | “无法启运在途：当前运单尚未在阶段 3 分配集装箱货柜，请先完成装柜配载！” |
| **推进至 阶段 5 (清关/派送)** | `SEA_LCL`<br>`SEA_FCL`<br>`AIR` | ① 海运：必须已有阶段 4 实际开船日 (`sailingDate`，班轮已启运)；必须录入清关完成日、海关税单及**目的港送柜拖车信息（司机姓名、联系电话、车牌号、送达时间）**；<br>② 空运：必须已有阶段 4 到海外仓记录 | “无法办理清关：当前集装箱尚未在阶段 4 记录实际开船日，请先完善开船信息！”<br>“请完善目的港送柜拖车信息！” |
| **推进至 阶段 6 (送达签收)** | `SEA_LCL`<br>`SEA_FCL`<br>`AIR` | ① 海运：**必须已有阶段 5 清关放行记录 (`clearanceDate` 存在) 且具备送柜拖车送达记录**；必须录入客户签收日期 (`signedDate`)；<br>② 空运：**必须已有阶段 5 海外派送中记录**；必须录入客户签收日期 | ❌ **“无法完成签收：当前运单尚未在阶段 5 记录目的港清关放行及送柜拖车信息，请先完善阶段 5 数据！”** |

### 7.3 阶段 5 目的港送柜拖车数据沉淀标准
在海运整柜与拼箱中，目的港清关后由车队提柜送往目的仓/收件人工厂，拖车信息直接存入 `ContainerMaster` 原生字段并全柜共享：
- `driverName`: 司机姓名（如 Kuya Juan / 张师傅）
- `driverPhone`: 司机联系电话
- `truckPlateNo`: 拖车车牌号码（如 NBD-8821）
- `truckingDate`: 订车/提柜时间
- `destArrivedDate`: 送达目的地仓库时间

---

## ⚡ 8. 单一流转推进入口与货柜状态自动联动规范

为了杜绝卡片与 Banner 双按钮职责混乱、状态原地踏步的死循环，系统实施**职责单一化**与**货柜状态全自动流转**：

### 8.1 交互职责单一化设计
1. **顶部 6 阶段卡片 ➔ 纯粹作为【历史快照与阶段数据查看/修改中心】**：
   - 处于当前及历史阶段的卡片，底部文案统一为 **【✏️ 点击查看/修改】**；
   - 点击打开弹窗后，保存行为仅更新该阶段的基础字段，**绝不越权改变运单生命阶段**；
2. **底部深蓝色 Banner ➔ 全页面唯一的【生命阶段流转推进中心 (Single Transition Engine)】**：
   - 永远展示当前待办推进动作（$N \to N+1$）；
   - 右侧唯一流转按钮，点击打开目标待办阶段的模态框；
   - 录入完毕后点击“确认流转”，**一键推进运单生命阶段 + 自动联动货柜状态**。

### 8.2 货柜状态全自动联动矩阵
业务员无需单独维护货柜状态，系统根据生命阶段推进自动联动：
- 推进至 **阶段 3 (进港报关/装柜)**：货柜状态为 `LOADING`；
- 推进至 **阶段 4 (干线航运/在途)**：货柜状态自动同步为 **`SAILING` (航行中)**；
- 推进至 **阶段 5 (目的港清关/拆派)**：货柜状态自动同步为 **`DISPATCHING` (拆派中)**；
- 推进至 **阶段 6 (送达签收完结)**：若整柜内所有运单已签收，货柜状态自动完结为 **`COMPLETED`**。







