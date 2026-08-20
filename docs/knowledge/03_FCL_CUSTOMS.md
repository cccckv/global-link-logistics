# 业务模块 03：整柜海运、清关与全流程跟踪 (FCL & Customs)

> 参考数据源：
> - `整柜信息进度表2026.8.13(1).xlsx` -> `清关`
> - `万海入库计划表 龙岩 空运2026.8.13.xlsx` -> `拆派情况`

---

## 📌 1. 业务概念与场景

整柜业务是国际海运的核心骨干，涵盖两种业务形态：
1. **客户单独整包整柜（SEA_FCL）**：大客户（如 `WH-77777`）独占一整个货柜（20GP / 40HQ）；
2. **自营散货拼箱出海（SEA_LCL）**：将数十票散货运单（Waybills）配载装入同一个物理集装箱（ContainerMaster）出海。

整柜跟踪贯穿 **国内装柜 ➔ 订舱装船 ➔ 海运干线 ➔ 目的港清关 ➔ 提柜拆箱派送** 全生命周期。

---

## 📋 2. 核心数据字段与数据库模型映射

### 2.1 集装箱主表 (`ContainerMaster`)
| 业务字段名称 | 真实 Excel 示例 | 数据库表与字段 (`schema.prisma`) | 字段类型 / 说明 |
| :--- | :--- | :--- | :--- |
| **集装箱柜号** | `MILU6019768`, `FFAU7478798` | `ContainerMaster.containerNo` | `String @unique`（4位前缀+7位数字标准箱号） |
| **箱型规格** | `40HQ`, `20GP` | `ContainerMaster.containerType` | `String?` |
| **海运提单号 (B/L No)** | `MCLPXMN082208`, `SNLGXGPL408017` | `ContainerMaster.blNumber` | `String?`（**全系统唯一海运提单号字段**） |
| **承运船司 (Carrier)** | `中远海运(COSCO)`, `万海(WHL)` | `ContainerMaster.carrier` | `String?` |
| **船名 / 航次** | `WAN HAI 312 V.S012` | `ContainerMaster.vesselVoyage` | `String?` |
| **船舶 MMSI / IMO** | `413999999 / 9329000` | `ContainerMaster.mmsi / imo` | `String?`（对接 AIS 船讯网实时船舶定位） |
| **出口港口 (Origin)** | `厦门港`, `天津港`, `广州南沙` | `ContainerMaster.originPort` | `String?` |
| **清关港口 (Destination)**| `南港(Manila South)`, `北港`, `巴生北` | `ContainerMaster.destinationPort` | `String?` |
| **装柜时间** | `2026-01-02` | `ContainerMaster.loadingDate` | `DateTime?` |
| **开船时间 (ETD)** | `2026-01-05` | `ContainerMaster.sailingDate` | `DateTime?`（实际开船离港日期） |
| **预计到港 (ETA)** | `2026-01-20` | `ContainerMaster.eta` | `DateTime?` |
| **清关送达时间** | `2026-01-21` | `ContainerMaster.clearanceDate` | `DateTime?`（通关并送达海外仓时间） |
| **总计航运天数** | `16`, `28`, `36` | `ContainerMaster.totalShippingDays`| `Int?`（系统公式：`clearanceDate - loadingDate`） |
| **查验状态 (异常)** | `TIIU5779829 查验柜`, `正常放行` | `ContainerMaster.inspectStatus` | `String?`（海关扣审查验状态） |
| **当前物流状态** | `SAILING`, `CUSTOMS` | `ContainerMaster.status` | `ContainerStatus` 枚举 |
| **订舱渠道** | `优尼科`, `泉州万海-渠道5` | `ContainerMaster.bookingChannel` | `String?` |
| **报关渠道** | `中外运`, `报关资料群` | `ContainerMaster.customsChannel` | `String?` |
| **清关渠道** | `泉州万海-菲立亚清关公司` | `ContainerMaster.clearanceChannel` | `String?` |
| **拖车渠道** | `厦门联运`, `优尼科` | `ContainerMaster.truckingChannel` | `String?` |

---

### 2.2 整柜干线全链路费用明细 (`ContainerFee`)
| 费用科目 (`feeSubject`) | 真实 Excel 记录示例 | 默认币种 | 费用归属与业务说明 |
| :--- | :--- | :--- | :--- |
| `BOOKING_FEE` | `USD+235`, `USD+1100` | USD / CNY | 支付给船司/庄家的海运纯订舱费 |
| `PORT_SURCHARGE` | `2300`, `2200` | CNY | 出口码头作业费、港杂费 |
| `TRUCKING_FEE` | `拖车3200`, `拖车5000` | CNY | 国内提货送港卡车拖车费 |
| `CUSTOMS_FEE` | `8023`, `500` | CNY | 出口报关行代理费与产地证 (Form E) 费用 |
| `CLEARANCE_FEE` | 协议价 | PHP / CNY | 目的港清关代理申报与通关成本 |
| `THC_OVERSTAY_FEE` | `thc 7859.2peso`, `14918.66peso` | PHP (比索) | 目的港码头操作费 (THC) 及超期免堆存费 |
| `DEST_TRUCKING_FEE` | `22000`, `23000` | PHP / CNY | 目的港码头到海外仓/收货点的送柜拖车费 |
| `HOLIDAY_TIP` | `500`, `1000` | PHP | 目的港节假日司机加班或小费补助 |
| `CLIENT_QUOTATION` | `28000`, `32000` | CNY | 向整柜包柜客户收取的包干总价 (RECEIVABLE) |

---

## 🔗 3. 整柜与散货运单的联动关系与操作

```
[整柜 (ContainerMaster): MILU6019768 (厦门港 -> 马尼拉南港, 16天, 提单号: MCLPXMN082208)]
   │
   ├── [散货运单 1]: LCL2608160001 / WH-ZZY-FLB / 背心 1件 / 0.23 CBM / 广州仓
   ├── [散货运单 2]: LCL2608160002 / WH-10115 / PR0099 5件 / 0.22 CBM / 龙岩仓
   └── [散货运单 3]: LCL2608160003 / WH-N0019 / 收纳袋 1件 / 0.07 CBM / 龙岩仓
```

### 3.1 核心联动特性：
1. **批量排柜关联 (`/api/v2/waybills/batch-assign-container`)**：调度员在运单列表勾选多票散货，一键指派至目标集装箱，批量将散货状态推进至 `LOADED`。
2. **状态自动级联同步**：当集装箱更新为开船 `SAILING`、目的港 `CUSTOMS` 时，其名下挂载的所有散货运单状态自动联动更新，无需逐票人工修改。
3. **整柜穿透汇总统计**：集装箱详情页自动穿透统计名下所有散货的总票数、总件数、总 CBM、总应收运费与预估毛利。
4. **AIS 船舶地图定位**：依托 `vesselVoyage` / `mmsi` / `imo`，系统直接调用地图雷达与船舶追踪接口展示集装箱船实时海上轨迹。

### 3.2 集装箱全维度信息纠偏维护规范
- **全量主数据可维护**：支持修改集装箱主表的全部维度属性（包括集装箱柜号 `containerNo`、柜型规格 `containerType`、装柜日期 `loadingDate`、起运/目的港口、海运提单号 `blNumber`、承运船司 `carrier`、船名航次 `vesselVoyage`、ETD/ETA/清关日期、订舱/报关/清关/拖车渠道以及备注 `note`）；
- **柜号防重校验**：修改柜号时，后端必须实施唯一性冲突校验（Prisma `P2002`），并友好提示防重。

### 3.3 集装箱整柜流转与完结校验准则
- **全部完结强校验**：只有在集装箱名下装载的**所有拼箱运单状态均为「已签收完结」(DELIVERED)** 时，方允许将货柜状态标记为 **「全部完结」(COMPLETED)**；
- **双重拦截与精准提示**：若柜内仍有未签收运单，前后端必须实施双重拦截，并精准列出未签收运单号及票数，禁止直接完结货柜。

### 3.4 集装箱安全删除与散货解绑回退机制
- **二次防误触确认**：删除集装箱货柜时，前端必须实施二次防误触确认（若柜内有装载散货，高亮提示散货解绑去向）；
- **散货保护与状态回退**：后端在删除 `ContainerMaster` 时，必须安全自动解绑（`containerId: null`）名下装载的全部拼箱散货运单，并将运单状态重置回 `INBOUND`（已入库待装柜），严禁破坏散货实测数据；
- **整柜费用与附件级联清理**：整柜专属成本费用（`ContainerFee`）与附件凭据（`ContainerAttachment`）实行级联安全清理。

