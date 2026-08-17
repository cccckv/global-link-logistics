# 业务模块 02：空运业务与计费体系 (Air Freight)

> 参考数据源：
> - `万海入库计划表 龙岩 空运2026.8.13.xlsx` -> `空运`
> - `万海入库计划表 印尼 泰国 马来 2026.8.13.xlsx.xlsx` (空运部分)

---

## 📌 1. 业务概念与场景

空运通常用于高时效、高货值或小批量紧急包裹（如电商小包、配件、紧急文件/样品等）。
与海运按体积（CBM）计费不同，空运主要按 **重量 (kg)** 计费，且结算周期快、时效短（通常 3-7 天完成国内发运到海外签收）。

---

## 📋 2. 核心数据字段与数据库模型映射

| 业务字段名称 | 真实 Excel 示例 | 数据库表与字段 (`schema.prisma`) | 字段类型 / 说明 |
| :--- | :--- | :--- | :--- |
| **系统运单号** | `AWB2608170001` | `Waybill.waybillNo` | `String @unique`（全局统一业务主单号） |
| **业务类型** | `AIR` | `Waybill.orderType` | 固定为 `ShipmentType.AIR` |
| **入库时间** | `2026.1.2` | `Waybill.inboundDate` | `DateTime?`（货物到达国内集货仓日期） |
| **客户编码/唛头** | `WH-10096`, `WH-10068` | `Waybill.userMark` | `String`（关联 `Customer` 档案） |
| **签收时间** | `2026.1.5`, `2026.1.10` | `Waybill.signedDate` | `DateTime?`（海外客户签收日期） |
| **渠道 / 专线** | `菲通货运` | `Waybill.forwarderChannel` | `String?`（空运一级专线庄家/航空公司） |
| **国内快递单号** | `3254`, `5931`, `0401` | `WaybillItem.trackingNumber` | `String?`（国内寄件送仓快递号） |
| **空运主单号 (AWB)** | `91041985`, `91041999` | `Waybill.airWaybillNo` | `String?`（航空公司/庄家签发的主空运单号） |
| **品名** | `配件`, `样品` | `WaybillItem.productName` | `String`（商品中文品名） |
| **合计重量 (kg)** | `1.5`, `11.0`, `20.0` | `WaybillItem.totalWeight` / `Waybill.totalWeightKg` | `Decimal?`（计费重量/实重，单位：kg） |
| **应收单价 (元/kg)** | `38.5`, `45.0` | `WaybillItem.receivableUnitPrice` | `Decimal?`（向客户收取的每公斤单价） |
| **应付成本 (元/kg)** | `35.0`, `38.0` | `WaybillItem.payableUnitPrice` | `Decimal?`（支付给空运渠道商的每公斤成本） |
| **内部车费 (元)** | `99`, `6件102-1` | `WaybillFee` (`feeName: "内部车费"`, `direction: PAYABLE`) | `amount: Decimal`, `note: "6件分摊102元之第1件"` |
| **应付渠道车费 (元)** | `93`, `5件75-1` | `WaybillFee` (`feeName: "渠道车费"`, `direction: PAYABLE`) | `amount: Decimal`, `note: "5件分摊75元之第1件"` |
| **总应收金额** | `57.75`, `423.5`, `770`| `Waybill.receivableAmount` | `Decimal?`（公式：$\text{重量} \times \text{应收单价}$） |
| **总应付金额** | `52.50`, `385.0` | `Waybill.payableAmount` | `Decimal?`（干线成本 + 车费等） |
| **预估利润** | `5.25`, `38.5` | `Waybill.profitAmount` | `Decimal?`（应收 - 应付） |

---

## 🧮 3. 核心计算公式与业务规则

1. **空运应收计算**:
   $$\text{应收金额 (RMB)} = \text{合计重量 (kg)} \times \text{应收单价 (RMB/kg)}$$
   *例如：$11.0\text{kg} \times 38.5\text{元/kg} = 423.5\text{元}$*

2. **空运应付成本计算**:
   $$\text{空运干线成本 (RMB)} = \text{合计重量 (kg)} \times \text{应付成本单价 (RMB/kg)}$$

3. **空运全成本与毛利计算**:
   $$\text{实际总成本} = \text{空运干线成本} + \sum \text{内部车费} + \sum \text{渠道车费}$$
   $$\text{净毛利 (RMB)} = \text{应收金额} - \text{实际总成本}$$

---

## 💡 4. 空运业务特性与系统关注点

- **单号体系清晰划分**：
  1. `Waybill.waybillNo`：系统全局唯一母单号（如 `AWB2608170001`）；
  2. `Waybill.airWaybillNo`：航空公司/货代空运提单号（如 `91041985`）；
  3. `WaybillItem.trackingNumber`：国内快递送仓单号（如 `SF1001`）。
- **高频快周转**：空运入库后通常在 1-2 天内起飞，支持从预报直接快速录入重量和单价。
- **车费拆分机制**：支持将诸如“`6件102-1`”解析为数值金额存入 `WaybillFee.amount`，并将分摊说明存入 `WaybillFee.note`。
