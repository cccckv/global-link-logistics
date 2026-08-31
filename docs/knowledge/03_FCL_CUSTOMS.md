# 业务模块 03：海运整柜业务体系与全生命周期规范 (FCL & Customs)

> 参考数据源：
> - `整柜信息进度表2026.8.13(1).xlsx` -> `清关`
> - `万海入库计划表 龙岩 空运2026.8.13.xlsx` -> `拆派情况`

---

## 📌 1. 业务概念与全生命周期闭环

海运整柜（SEA_FCL）是外贸大宗物流的骨干业务（如大客户 `WH-77777` 独占一整个货柜 20GP / 40HQ / 45HQ）。
**整柜业务核心特性与红线**：
1. **纯门到港/门到门（不入国内集拼仓）**：货代订舱提空箱 ➔ 拖车开至厂家工厂装货（产地装箱） ➔ 司机锁封条后直接将重柜送达码头集港（Gate-in）报关 ➔ 装船开航；
2. **起运点必须是【国内起运港口】**（如厦门港、广州南沙港、深圳蛇口港、宁波港等），**严禁使用国内始发仓**；
3. **阶段 2（产地装箱）已知柜号**：司机去堆场提空箱前往工厂装货时，集装箱号（`containerNo`）已确定，在阶段 2 直接绑定并录入。

### 🚀 海运整柜 6 大生命阶段标准定义

```mermaid
graph LR
    S1["1. 订舱委托\n(DRAFT)"] -->|派车到厂装箱| S2["2. 产地装箱\n(INBOUND)\n直接录入柜号/件数"]
    S2 -->|拖车送码头| S3["3. 进港报关\n(LOADED)\n重柜集港与海关报关"]
    S3 -->|船舶离港| S4["4. 干线航运\n(IN_TRANSIT/SAILING)\n提单与订舱海运费"]
    S4 -->|到港清关| S5["5. 目的港清关\n(CUSTOMS/DISPATCHING)\n税单/THC/码头提柜"]
    S5 -->|工厂收货| S6["6. 送达签收\n(DELIVERED/COMPLETED)\n收货人签收，还空箱"]

    style S1 fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a
    style S2 fill:#fefce8,stroke:#eab308,color:#713f12
    style S3 fill:#f0fdf4,stroke:#22c55e,color:#14532d
    style S4 fill:#fdf4ff,stroke:#c084fc,color:#581c87
    style S5 fill:#fff7ed,stroke:#f97316,color:#7c2d12
    style S6 fill:#ecfdf5,stroke:#10b981,color:#064e3b
```

| 阶段序号与名称 | 状态代码 (`Waybill.status`) | 核心作业内容 | 核心字段映射与必填规范 |
| :--- | :--- | :--- | :--- |
| **1. 订舱委托** | `DRAFT` | 客户下整柜委托，确定箱型与整柜报价 | 客户唛头 (`userMark`)、**国内起运港口 (`originPort`)** ➔ 目的港口、箱型规格 (`20GP/40HQ`)、整柜包干报价 (`CLIENT_QUOTATION`) |
| **2. 产地装箱** | `INBOUND` | 拖车到工厂装箱落封，**直录柜号** | 装箱日期 (`loadingDate`)、**集装箱柜号 (`containerNo`，直接录入绑定)**、封条号、品名、总装箱件数、预估总重量/毛重 |
| **3. 进港报关** | `LOADED` | 拖车将重柜送达码头堆场并报关 | 码头进港还重日期、国内海关报关状态、国内拖车费 (`TRUCKING_FEE`) 与报关费 (`CUSTOMS_FEE`) |
| **4. 干线航运** | `IN_TRANSIT` | 班轮起运离港，提单签发与船期跟踪 | **海运提单号 (`blNumber`)**、承运船司/船名航次 (`vesselVoyage`)、ETD/ETA、海运纯订舱费 (`BOOKING_FEE`) |
| **5. 目的港清关** | `DISPATCHING` | 船舶到港，海外清关并从码头提柜送货 | 清关放行日期 (`clearanceDate`)、总航运天数、海关税单 (`CUSTOMS_SLIP`)、THC/超堆费 (`THC_OVERSTAY_FEE`)、送柜拖车费 |
| **6. 送达签收** | `DELIVERED` | 海外收件人拆箱收货签字，还空箱完结 | **客户签收日期 (`signedDate`)**、**签收单回执照片 (`SIGN_IMAGE`)**、锁定整柜净毛利 |

---

## 📋 2. 核心数据字段与数据库模型映射 (方案 A：零迁移规范)

### 2.1 集装箱主表 (`ContainerMaster`)
| 业务字段名称 | 真实 Excel 示例 | 数据库表与字段 (`schema.prisma`) | 字段类型 / 说明 |
| :--- | :--- | :--- | :--- |
| **集装箱柜号** | `MILU6019768`, `FFAU7478798` | `ContainerMaster.containerNo` | `String @unique`（4位前缀+7位数字标准箱号，**阶段2直接录入**） |
| **箱型规格** | `40HQ`, `20GP` | `ContainerMaster.containerType` | `String?` |
| **海运提单号 (B/L No)** | `MCLPXMN082208`, `SNLGXGPL408017` | `ContainerMaster.blNumber` | `String?`（**全系统唯一海运提单号字段**，阶段4出具） |
| **承运船司 (Carrier)** | `中远海运(COSCO)`, `万海(WHL)` | `ContainerMaster.carrier` | `String?` |
| **船名 / 航次** | `WAN HAI 312 V.S012` | `ContainerMaster.vesselVoyage` | `String?` |
| **船舶 MMSI / IMO** | `413999999 / 9329000` | `ContainerMaster.mmsi / imo` | `String?`（对接 AIS 船讯网实时船舶定位） |
| **国内起运港口** | `厦门港`, `天津港`, `广州南沙港` | `ContainerMaster.originPort` | `String?`（**整柜起运点，严禁使用始发仓**） |
| **清关目的港口**| `马尼拉南港`, `马尼拉北港`, `巴生北港` | `ContainerMaster.destinationPort` | `String?` |
| **装箱日期** | `2026-01-02` | `ContainerMaster.loadingDate` | `DateTime?`（工厂产地装箱时间，阶段2） |
| **开船时间 (ETD)** | `2026-01-05` | `ContainerMaster.sailingDate` | `DateTime?`（实际开船离港日期，阶段4） |
| **预计到港 (ETA)** | `2026-01-20` | `ContainerMaster.eta` | `DateTime?` |
| **清关送达时间** | `2026-01-21` | `ContainerMaster.clearanceDate` | `DateTime?`（通关并提柜送达时间，阶段5） |
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

### 3.3 集装箱整柜流转与完结校验准则 (Auto-Completion & Safe Validation)
- **全部完结强校验**：只有在集装箱名下装载的**所有拼箱运单状态均为「已签收完结」(DELIVERED)** 时，方允许将货柜状态标记为 **「全部完结」(COMPLETED)**；若柜内仍有未签收运单，前后端必须实施双重拦截，并精准列出未签收运单号及票数；
- **最后一笔签收自动完结 (Auto-Completion)**：当柜内最后一笔散货运单完成签收（状态变更为 `DELIVERED`）时，后端检测到柜内所有散货均已 100% 签收，**自动触发将集装箱主表状态更新为 `COMPLETED`（全部完结）**，无需调度人员重复手动修改；
- **异常撤销与阶段回退自愈 (Auto-Healing Rollback)**：若某票已完结运单被撤销签收或回退阶段（状态变为非 `DELIVERED`），后端检测到集装箱处于 `COMPLETED` 时，**自动将集装箱状态回退至 `DISPATCHING` (海外拆派中)**，确保货柜状态时刻与末端真实签收进度保持一致。

### 3.4 集装箱安全删除与散货解绑回退机制
- **二次防误触确认**：删除集装箱货柜时，前端必须实施二次防误触确认（若柜内有装载散货，高亮提示散货解绑去向）；
- **散货保护与状态回退**：后端在删除 `ContainerMaster` 时，必须安全自动解绑（`containerId: null`）名下装载的全部拼箱散货运单，并将运单状态重置回 `INBOUND`（已入库待装柜），严禁破坏散货实测数据；
- **整柜费用与附件级联清理**：整柜专属成本费用（`ContainerFee`）与附件凭据（`ContainerAttachment`）实行级联安全清理。

---

## 💡 4. 海运整柜专属交互与数据规范

1. **体积 (CBM) 直接手填支持**：
   - 预报与装箱阶段均支持直接输入总方数（如 `28.5 CBM`），无需强行测量或倒推长宽高；
2. **阶段 2 内嵌快捷新建集装箱**：
   - 产地装箱弹窗中内嵌【➕ 快速新建集装箱】小弹窗，录入柜号、箱型（40HQ/20GP）、起运港、目的港与提单号后保存，自动刷新下拉列表并直接高亮选中新柜号；
3. **阶段 2 产地实际装箱清单 (Actual Packing List)**：
   - 整柜模式下，阶段 2 清单录入品名、**实际装箱件数**、**实际装箱总方数 (CBM)**、**实际总毛重/VGM (kg)**；
   - 隐藏散货拼箱专属的小件单价与车费列；
4. **主界面“整柜装箱明细与双轨数据对比”专属卡片**：
   - 整柜模式下，双轨数据对比卡片彻底去仓库化、去快递号化，直观呈现【阶段 1 客户委托预报】vs【阶段 2 产地实际装箱】的件数、方数与重量偏差，以及 1:1 绑定的集装箱柜号与箱型。

---

## 🚛 5. 目的港送柜拖车 (Dest Drayage) 必填规范与数据继承共享机制

海关清关放行后，集装箱从码头/海关监管区拉往目的地仓库（拼箱拉往海外拆箱仓 CFS，整柜拉往目的仓），系统必须记录 5 大核心拖车信息：

### 5.1 核心字段定义 (`ContainerMaster`)
| 字段名称 | 数据库字段 | 必填性 | 说明 |
| :--- | :--- | :---: | :--- |
| **司机姓名** | `driverName` | **必填** | 目的港送柜司机姓名 (如 `Kuya Juan` / `张师傅`) |
| **联系电话** | `driverPhone` | **必填** | 司机有效联系方式 (如 `0917-888-9999`) |
| **车牌号码** | `truckPlateNo` | **必填** | 拖车车牌号码 (如 `NBD-8821` / `闽C-89821`) |
| **订车/提柜时间** | `truckingDate` | **必填** | 向车队订车或码头提柜发车起运时间 |
| **送达仓库时间** | `destArrivedDate` | **必填** | 拖车将集装箱送达目的地仓库的时间 |

> **关键准则**：到达的仓库从整个生命周期初（目的港与仓储体系）即已确定，无需在拖车中冗余记录目的地；整柜订单**严禁带出客户海外私密收件地址**。

### 5.2 拼箱运单免重复录入与自动继承机制
- 拼箱柜（SEA_LCL）下包含数十票散货运单，拖车信息物理上归属于集装箱（`ContainerMaster`）；
- 柜内任意一票运单或调度员首次录入拖车信息后，其他同行拼箱运单在打开【阶段 5 清关与拆派】模态框时，**自动继承并预填全部拖车数据**，并显示绿色继承徽章，业务员免于重复誊抄，只需确认即可快速推进。

### 5.3 阶段 5 强制必填卡点
- 当海运订单（整柜/拼柜）试图推进流转至【海外拆派中 (DISPATCHING)】时，系统**强制校验上述 5 大拖车字段**；若有任何一项缺失，严格拦截并禁止推进。



