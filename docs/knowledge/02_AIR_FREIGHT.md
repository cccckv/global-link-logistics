# 业务模块 02：空运业务体系与全生命周期规范 (Air Freight)

> 参考数据源：
> - `万海入库计划表 龙岩 空运2026.8.13.xlsx` -> `空运`
> - `万海入库计划表 印尼 泰国 马来 2026.8.13.xlsx.xlsx` (空运部分)

---

## 📌 1. 业务概念与全生命周期闭环

空运通常用于高时效、高货值或小批量紧急包裹（如电商小包、配件、紧急文件/样品等）。
与海运按体积（CBM）计费不同，空运主要按 **重量 (kg)** 计费，且结算周期快、时效短（通常 3-7 天完成国内发运到海外签收）。

### 🚀 空运 6 大生命阶段标准定义

```mermaid
graph LR
    S1["1. 客户预报\n(DRAFT)"] -->|包裹到仓| S2["2. 到仓实测\n(INBOUND)"]
    S2 -->|打包出库| S3["3. 仓库发货\n(LOADED)"]
    S3 -->|运抵海外| S4["4. 到海外仓\n(IN_TRANSIT)"]
    S4 -->|安排派送| S5["5. 海外派送\n(DISPATCHING)"]
    S5 -->|客户签收| S6["6. 签收完结\n(DELIVERED)"]

    style S1 fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a
    style S2 fill:#fefce8,stroke:#eab308,color:#713f12
    style S3 fill:#f0fdf4,stroke:#22c55e,color:#14532d
    style S4 fill:#fdf4ff,stroke:#c084fc,color:#581c87
    style S5 fill:#fff7ed,stroke:#f97316,color:#7c2d12
    style S6 fill:#ecfdf5,stroke:#10b981,color:#064e3b
```

| 阶段序号与名称 | 状态代码 (`Waybill.status`) | 核心作业内容 | 核心字段映射与必填规范 |
| :--- | :--- | :--- | :--- |
| **1. 客户预报** | `DRAFT` | 客户或业务员录入预报信息 | 客户唛头 (`userMark`)、品名 (`productName`)、国内送仓快递单号 (`trackingNumber`)、预报件数、收件人信息 |
| **2. 到仓实测** | `INBOUND` | 仓库收货过磅，实测重量与计费 | 入库时间 (`inboundDate`)、**实测重量 (`totalWeightKg`)**、应收/应付单价 (元/kg)、车费杂费 (`WaybillFee`) |
| **3. 仓库发货** | `LOADED` | 打包出库，交接给空运专线/庄家 | 发货时间 (`loadingDate`)、承运专线 (`forwarderChannel`)、**【发货运单号】必填 (`expressNo` / `airWaybillNo`)**。**彻底去海运化，无需柜号与航班号** |
| **4. 到海外仓** | `IN_TRANSIT` | 专线干线空运及双清完成，到达目的国分拨仓 | **到达海外仓时间 (`clearanceDate`)**、海外中转分拨仓点备注 |
| **5. 海外派送** | `DISPATCHING` | 海外仓出库派送，末端司机/快递派送 | 派送出库时间、派送方式（本地专车/本地快递/自提）、派送单号/司机信息 |
| **6. 签收完结** | `DELIVERED` | 客户收货签字，回传回执单，财务归档 | **客户签收日期 (`signedDate`)**、**签收凭证回执图片 (`SIGN_IMAGE`)**、锁定纯毛利 |

---

## 📋 2. 核心数据字段与数据库模型映射 (方案 A：零迁移规范)

| 业务字段名称 | 真实 Excel 示例 | 数据库表与字段 (`schema.prisma`) | 字段类型 / 说明 |
| :--- | :--- | :--- | :--- |
| **系统运单号** | `AWB2608170001` | `Waybill.waybillNo` | `String @unique`（全局统一业务主单号） |
| **业务类型** | `AIR` | `Waybill.orderType` | 固定为 `ShipmentType.AIR` |
| **客户编码/唛头** | `WH-10096`, `WH-10068` | `Waybill.userMark` | `String`（关联 `Customer` 档案） |
| **国内送仓单号** | `3254`, `5931`, `SF1001` | `WaybillItem.trackingNumber` | `String?`（国内寄件送仓快递号，阶段1） |
| **入库时间** | `2026.1.2` | `Waybill.inboundDate` | `DateTime?`（货物到达国内集货仓日期，阶段2） |
| **合计重量 (kg)** | `1.5`, `11.0`, `20.0` | `Waybill.totalWeightKg` / `WaybillItem.totalWeight` | `Decimal?`（实重，单位：kg，阶段2核心计费项） |
| **应收单价 (元/kg)** | `38.5`, `45.0` | `WaybillItem.receivableUnitPrice` | `Decimal?`（向客户收取的每公斤单价） |
| **应付成本 (元/kg)** | `35.0`, `38.0` | `WaybillItem.payableUnitPrice` | `Decimal?`（支付给空运渠道商的每公斤成本） |
| **内部车费 (元)** | `99`, `6件102-1` | `WaybillFee` (`feeName: "内部车费"`, `direction: PAYABLE`) | `amount: Decimal`, `note: "6件分摊102元之第1件"` |
| **应付渠道车费 (元)** | `93`, `5件75-1` | `WaybillFee` (`feeName: "渠道车费"`, `direction: PAYABLE`) | `amount: Decimal`, `note: "5件分摊75元之第1件"` |
| **发货出库时间** | `2026.1.3` | `Waybill.loadingDate` | `DateTime?`（仓库发货时间，阶段3） |
| **承运专线渠道** | `菲通货运`, `天帆专线` | `Waybill.forwarderChannel` | `String?`（空运一级专线庄家/航空公司） |
| **发货运单号 (必填)** | `FLY100002162`, `91041985` | `Waybill.expressNo` / `Waybill.airWaybillNo` | `String`（**阶段3发货时仓库必填**，专线转运单号/提单号） |
| **到达海外仓时间** | `2026.1.4` | `Waybill.clearanceDate` | `DateTime?`（到达目的国海外中转仓时间，阶段4） |
| **海外签收时间** | `2026.1.5`, `2026.1.10` | `Waybill.signedDate` | `DateTime?`（海外客户签收日期，阶段6） |
| **总应收金额** | `57.75`, `423.5`, `770`| `Waybill.receivableAmount` | `Decimal?`（公式：$\text{重量} \times \text{应收单价}$） |
| **总应付金额** | `52.50`, `385.0` | `Waybill.payableAmount` | `Decimal?`（干线成本 + 车费等） |
| **预估纯利润** | `5.25`, `38.5` | `Waybill.profitAmount` | `Decimal?`（应收 - 应付） |

---

## 🧮 3. 核心计算公式与计费体系规范

1. **当前计费体系（V2 阶段）：纯重量计费**
   $$\text{应收金额 (RMB)} = \text{合计重量 (kg)} \times \text{应收单价 (RMB/kg)}$$
   $$\text{空运干线成本 (RMB)} = \text{合计重量 (kg)} \times \text{应付成本单价 (RMB/kg)}$$
   *例如：$11.0\text{kg} \times 38.5\text{元/kg} = 423.5\text{元}$*

2. **全成本与净毛利核算**:
   $$\text{实际总成本} = \text{空运干线成本} + \sum \text{内部车费} + \sum \text{渠道车费}$$
   $$\text{净毛利 (RMB)} = \text{应收金额} - \text{实际总成本}$$

3. **未来扩展预留（V3 阶段）：实重与体积重取大者方案**
   - 数据库模型 `WaybillItem` 已原生具备 `length, width, height`（尺寸）与 `totalWeight`（实重）字段；
   - 算法公式预留：
     $$\text{体积重 (kg)} = \frac{L(\text{cm}) \times W(\text{cm}) \times H(\text{cm})}{6000} \quad (\text{或 } 5000)$$
     $$\text{计费重量} = \max(\text{实重}, \text{体积重})$$

---

## 💡 4. 空运业务特性与关键设计准则

1. **去海运化 & 去航班化**：
   - 仓库出货只对接专线货代，**无法且无需提供航班号**；
   - 严禁在空运界面强求或展示“集装箱柜号”、“船名航次”、“开船时间”等海运特有概念。
2. **运单号录入职责彻底解耦（方案 1 规范）**：
   - **阶段 2（到仓实测）不展示运单号输入框**：阶段 2 仅聚焦于“入库日期 + 实测总重(kg) + 单价/车费核算”；
   - **阶段 3（仓库发货）作为唯一必填录入入口**：货物打包出库发往专线时，必须强制录入【发货运单号（`expressNo`）】，未填阻止流转。
3. **单号体系严格划分**：
   - `waybillNo`：系统全局母单号（如 `AWB2608170001`）；
   - `trackingNumber`：国内送仓快递单号（如 `SF1001`，客户寄往集拼仓，阶段 1 录入）；
   - `expressNo` / `airWaybillNo`：仓库发货转运单号（如 `FLY100002162`，专线发往海外，阶段 3 必填）。

