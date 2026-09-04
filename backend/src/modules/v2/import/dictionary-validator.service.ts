import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 系统标准静态字典
export const VALID_DESTINATION_COUNTRIES = [
  '菲律宾',
  '印度尼西亚',
  '泰国',
  '马来西亚',
  '越南',
  '新加坡',
  '缅甸',
  '柬埔寨',
  '老挝',
  '文莱',
];

export const VALID_PORTS_BY_COUNTRY: Record<string, string[]> = {
  '菲律宾': ['马尼拉南港', '马尼拉北港', '宿务港', '达沃港', '苏比克湾港', '伊洛伊洛港', '八打雁港', '卡加延德奥罗港'],
  '印度尼西亚': ['丹戎不碌港', '雅加达港', '泗水港', '棉兰港 (勿老湾)', '三宝垄港', '望加锡港', '巨港港', '坤甸港'],
  '泰国': ['林查班港', '曼谷港', '兰差邦港', '宋卡港', '普吉港'],
  '马来西亚': ['巴生港', '巴生北港', '巴生西港', '槟城港', '柔佛港 (巴西古当)', '关丹港', '山打根港', '古晋港'],
  '越南': ['胡志明港 (卡莱)', '海防港', '岘港港', '归仁港', '头顿港'],
  '新加坡': ['新加坡港', '裕廊港'],
  '缅甸': ['仰光港', '土瓦港', '皎漂港'],
  '柬埔寨': ['西哈努克港', '金边港'],
  '老挝': ['万象内陆港', '沙湾拿吉港'],
  '文莱': ['摩拉港', '斯里巴加湾港'],
};

export const ALL_VALID_PORTS = Array.from(new Set(Object.values(VALID_PORTS_BY_COUNTRY).flat()));

export const VALID_CUSTOMS_TYPES = ['普货双清', '化妆退税', '敏感特货'];

// 国内海运起运港标准字典
export const VALID_ORIGIN_PORTS = [
  '深圳蛇口港',
  '深圳盐田港',
  '深圳大铲湾港',
  '广州南沙港',
  '广州黄埔港',
  '厦门港',
  '泉州港',
  '宁波舟山港',
  '上海港',
  '天津港',
  '青岛港',
  '福州江阴港',
  '汕头港',
];

// 国际标准集装箱柜型字典
export const VALID_CONTAINER_TYPES = [
  '40HQ',
  '20GP',
  '40GP',
  '45HQ',
  '20OT',
  '40OT',
  '20FR',
  '40FR',
  '20RF',
  '40RF',
];

export interface DictionaryValidationResult {
  valid: boolean;
  standardValue?: string;
  errorMessage?: string;
}

export class DictionaryValidator {
  private originWarehousesCache: Array<{ code: string; name: string; shortName: string }> | null = null;
  private shippingChannelsCache: Array<{ name: string; code?: string | null }> | null = null;

  async loadMasterData() {
    if (!this.originWarehousesCache) {
      const warehouses = await prisma.originWarehouse.findMany({
        where: { isActive: true },
        select: { code: true, name: true, shortName: true },
      });
      this.originWarehousesCache = warehouses;
    }

    if (!this.shippingChannelsCache) {
      const channels = await prisma.shippingChannel.findMany({
        where: { isActive: true },
        select: { name: true, code: true },
      });
      this.shippingChannelsCache = channels;
    }
  }

  /**
   * 严格校验起运仓
   * 支持精确匹配：仓库全称 (如 广州白云集拼总仓)、简称 (如 广州仓) 或简码 (如 GZ-01)
   * 拦截模糊词 (如 广州)
   */
  async validateOriginWarehouse(input?: string): Promise<DictionaryValidationResult> {
    if (!input || !input.trim()) {
      return { valid: true }; // 选填字段若为空则放行
    }

    await this.loadMasterData();
    const clean = input.trim();

    // 1. 精确匹配全称、简称、简码
    const matched = this.originWarehousesCache?.find(
      (w) =>
        w.name.toLowerCase() === clean.toLowerCase() ||
        w.shortName.toLowerCase() === clean.toLowerCase() ||
        w.code.toLowerCase() === clean.toLowerCase()
    );

    if (matched) {
      return { valid: true, standardValue: matched.name };
    }

    // 2. 检查是否为模糊歧义词 (如用户只输入了城市名 "广州" 或 "深圳")
    const ambiguousMatches = this.originWarehousesCache?.filter(
      (w) => w.name.includes(clean) || w.shortName.includes(clean)
    );

    const warehouseOptions = this.originWarehousesCache?.map((w) => `${w.name} (${w.code})`).join('、');

    if (ambiguousMatches && ambiguousMatches.length > 0) {
      const candidateNames = ambiguousMatches.map((w) => w.name).join(' 或 ');
      return {
        valid: false,
        errorMessage: `起运仓【${clean}】不明确或为简称，系统存在具体仓库标准名。请从下拉列表中选择标准仓库全称（如：${candidateNames}）。`,
      };
    }

    return {
      valid: false,
      errorMessage: `起运仓【${clean}】不在系统有效起运仓列表中。有效仓库列表：${warehouseOptions}。`,
    };
  }

  /**
   * 严格校验目的国家
   */
  validateDestinationCountry(input?: string): DictionaryValidationResult {
    if (!input || !input.trim()) {
      return { valid: true, standardValue: '菲律宾' };
    }

    const clean = input.trim();
    const matched = VALID_DESTINATION_COUNTRIES.find(
      (c) => c.toLowerCase() === clean.toLowerCase()
    );

    if (matched) {
      return { valid: true, standardValue: matched };
    }

    return {
      valid: false,
      errorMessage: `目的国【${clean}】不在系统有效国家列表中。有效目的国：${VALID_DESTINATION_COUNTRIES.join('、')}。`,
    };
  }

  /**
   * 严格校验目的港口
   */
  validateDestinationPort(country?: string, port?: string): DictionaryValidationResult {
    if (!port || !port.trim()) {
      return { valid: true };
    }

    const cleanPort = port.trim();

    // 1. 精确匹配港口全称
    const matched = ALL_VALID_PORTS.find((p) => p.toLowerCase() === cleanPort.toLowerCase());
    if (matched) {
      return { valid: true, standardValue: matched };
    }

    // 2. 检查是否为模糊口岸 (如输入 "马尼拉" 未注明南北港)
    if (cleanPort === '马尼拉' || cleanPort === 'Manila') {
      return {
        valid: false,
        errorMessage: `目的港口【${cleanPort}】不明确，请从下拉列表中明确选择【马尼拉南港】或【马尼拉北港】。`,
      };
    }

    if (cleanPort === '巴生' || cleanPort === 'Port Klang') {
      return {
        valid: false,
        errorMessage: `目的港口【${cleanPort}】不明确，请从下拉列表中明确选择【巴生北港】或【巴生西港】。`,
      };
    }

    const validPortsForCountry = country && VALID_PORTS_BY_COUNTRY[country]
      ? VALID_PORTS_BY_COUNTRY[country].join('、')
      : ALL_VALID_PORTS.slice(0, 10).join('、') + '...';

    return {
      valid: false,
      errorMessage: `目的港口【${cleanPort}】不在系统有效港口列表中。推荐标准口岸：${validPortsForCountry}。`,
    };
  }

  /**
   * 严格校验报关/通道类型
   */
  validateCustomsType(input?: string): DictionaryValidationResult {
    if (!input || !input.trim()) {
      return { valid: true };
    }

    const clean = input.trim();
    const matched = VALID_CUSTOMS_TYPES.find((t) => t.toLowerCase() === clean.toLowerCase());

    if (matched) {
      return { valid: true, standardValue: matched };
    }

    return {
      valid: false,
      errorMessage: `报关/通道类型【${clean}】不合规。必须为：${VALID_CUSTOMS_TYPES.join('、')}。`,
    };
  }

  /**
   * 校验承运渠道/服务商
   */
  async validateForwarderChannel(input?: string): Promise<DictionaryValidationResult> {
    if (!input || !input.trim()) {
      return { valid: true };
    }

    await this.loadMasterData();
    const clean = input.trim();

    const matched = this.shippingChannelsCache?.find(
      (c) => c.name.toLowerCase() === clean.toLowerCase() || (c.code && c.code.toLowerCase() === clean.toLowerCase())
    );

    if (matched) {
      return { valid: true, standardValue: matched.name };
    }

    // 渠道若未严格命中，可允许作为自由服务商文本放行并提示，或返回原名
    return { valid: true, standardValue: clean };
  }

  /**
   * 严格校验国内海运起运港 (整柜专属)
   */
  validateOriginPort(input?: string): DictionaryValidationResult {
    if (!input || !input.trim()) {
      return { valid: true };
    }

    const clean = input.trim();
    const matched = VALID_ORIGIN_PORTS.find((p) => p.toLowerCase() === clean.toLowerCase());

    if (matched) {
      return { valid: true, standardValue: matched };
    }

    // 检查是否为简称 (如 "天津" -> "天津港", "蛇口" -> "深圳蛇口港", "盐田" -> "深圳盐田港", "南沙" -> "广州南沙港")
    const aliasesMap: Record<string, string> = {
      '天津': '天津港',
      '天津新港': '天津港',
      '蛇口': '深圳蛇口港',
      '蛇口港': '深圳蛇口港',
      '盐田': '深圳盐田港',
      '盐田港': '深圳盐田港',
      '南沙': '广州南沙港',
      '南沙港': '广州南沙港',
      '黄埔': '广州黄埔港',
      '黄埔港': '广州黄埔港',
      '厦门': '厦门港',
      '宁波': '宁波舟山港',
      '舟山': '宁波舟山港',
      '宁波港': '宁波舟山港',
      '上海': '上海港',
      '洋山': '上海港',
      '青岛': '青岛港',
      '泉州': '泉州港',
      '福州': '福州江阴港',
      '江阴港': '福州江阴港',
      '汕头': '汕头港',
    };

    if (aliasesMap[clean]) {
      return { valid: true, standardValue: aliasesMap[clean] };
    }

    return {
      valid: false,
      errorMessage: `起运港口【${clean}】不在系统有效起运港列表中。有效起运港口：${VALID_ORIGIN_PORTS.join('、')}。`,
    };
  }

  /**
   * 严格校验与归一化国际标准集装箱柜型
   */
  validateContainerType(input?: string): DictionaryValidationResult {
    if (!input || !input.trim()) {
      return { valid: true };
    }

    const clean = input.trim().toUpperCase().replace(/[\s_'-]/g, '');

    // 精确匹配
    const exact = VALID_CONTAINER_TYPES.find((t) => t.toUpperCase() === clean);
    if (exact) {
      return { valid: true, standardValue: exact };
    }

    // 智能别名与中文归一化
    const typeAliases: Record<string, string> = {
      '40HQ': '40HQ',
      'HQ40': '40HQ',
      '40HC': '40HQ',
      '40高柜': '40HQ',
      '40尺高柜': '40HQ',
      '40HQ高柜': '40HQ',
      '20GP': '20GP',
      'GP20': '20GP',
      '20普柜': '20GP',
      '20小柜': '20GP',
      '20尺普柜': '20GP',
      '20GP小柜': '20GP',
      '40GP': '40GP',
      'GP40': '40GP',
      '40普柜': '40GP',
      '40平柜': '40GP',
      '40尺普柜': '40GP',
      '40GP普柜': '40GP',
      '45HQ': '45HQ',
      'HQ45': '45HQ',
      '45HC': '45HQ',
      '45高柜': '45HQ',
      '45尺高柜': '45HQ',
      '45HQ超高柜': '45HQ',
      '20OT': '20OT',
      '20开顶': '20OT',
      '20尺开顶柜': '20OT',
      '40OT': '40OT',
      '40开顶': '40OT',
      '40尺开顶柜': '40OT',
      '20FR': '20FR',
      '20框架': '20FR',
      '20尺框架柜': '20FR',
      '40FR': '40FR',
      '40框架': '40FR',
      '40尺框架柜': '40FR',
      '20RF': '20RF',
      '20冷冻': '20RF',
      '20冷藏': '20RF',
      '20尺冷藏柜': '20RF',
      '40RF': '40RF',
      '40冷冻': '40RF',
      '40冷藏': '40RF',
      '40尺冷藏柜': '40RF',
    };

    const cleanNoChinese = input.trim().replace(/[\s_'-]/g, '');
    if (typeAliases[clean] || typeAliases[cleanNoChinese]) {
      return { valid: true, standardValue: typeAliases[clean] || typeAliases[cleanNoChinese] };
    }

    return {
      valid: false,
      errorMessage: `集装箱柜型【${input.trim()}】不合规。有效柜型：${VALID_CONTAINER_TYPES.join('、')}。`,
    };
  }

  /**
   * 严格校验与归一化结算币种 (CNY | PHP | USD)
   */
  validateCurrency(input?: string): DictionaryValidationResult {
    if (!input || !input.trim()) {
      return { valid: true, standardValue: 'CNY' };
    }
    const clean = input.trim().toUpperCase();
    if (clean.includes('PHP') || clean.includes('比索') || clean.includes('PESO')) {
      return { valid: true, standardValue: 'PHP' };
    }
    if (clean.includes('USD') || clean.includes('美元') || clean.includes('美金') || clean.includes('$')) {
      return { valid: true, standardValue: 'USD' };
    }
    if (clean.includes('CNY') || clean.includes('RMB') || clean.includes('人民币') || clean.includes('元') || clean.includes('¥')) {
      return { valid: true, standardValue: 'CNY' };
    }
    return {
      valid: false,
      errorMessage: `币种【${input.trim()}】不合规。有效币种：CNY (人民币)、PHP (菲律宾比索)、USD (美元)。`,
    };
  }
}

export const VALID_CURRENCIES = ['CNY', 'PHP', 'USD'] as const;

export const DEFAULT_EXCHANGE_RATES = {
  USD: 7.2, // 1 USD = 7.2 CNY (美元为贵币，折合人民币 = 美元金额 * 7.2)
  PHP: 8.0, // 1 CNY = 8.0 PHP (人民币为贵币，折合人民币 = 比索金额 / 8.0)
  CNY: 1.0,
};

/**
 * 遵循行业贵币计价法的折算函数
 */
export function convertAmountToCny(
  amount?: number | null,
  currency: string = 'CNY',
  inputRate?: number | null
): { amountInCny: number; effectiveRate: number } {
  const val = amount && !isNaN(Number(amount)) ? Number(amount) : 0;
  if (val === 0) {
    return { amountInCny: 0, effectiveRate: inputRate && Number(inputRate) > 0 ? Number(inputRate) : 1.0 };
  }

  const curr = (currency || 'CNY').toUpperCase();

  if (curr === 'USD') {
    const rate = inputRate && Number(inputRate) > 0 ? Number(inputRate) : DEFAULT_EXCHANGE_RATES.USD;
    return { amountInCny: Math.round(val * rate * 100) / 100, effectiveRate: rate };
  }

  if (curr === 'PHP') {
    const rate = inputRate && Number(inputRate) > 0 ? Number(inputRate) : DEFAULT_EXCHANGE_RATES.PHP;
    return { amountInCny: Math.round((val / rate) * 100) / 100, effectiveRate: rate };
  }

  return { amountInCny: Math.round(val * 100) / 100, effectiveRate: 1.0 };
}

