/**
 * Global Link Logistics - 业务字典与港口目的地级联映射
 * 包含东南亚主要国家及其主要清关目的港预设、国内起运仓、起运港
 */

export interface CountryPortConfig {
  name: string;
  enName: string;
  aliases: string[];
  defaultPort: string;
  ports: string[];
}

export const DESTINATION_COUNTRIES: CountryPortConfig[] = [
  {
    name: '菲律宾',
    enName: 'Philippines',
    aliases: ['philippines', 'ph', 'flb', 'PHL', '菲律宾专线'],
    defaultPort: '马尼拉南港',
    ports: [
      '马尼拉南港',
      '马尼拉北港',
      '宿务港',
      '达沃港',
      '苏比克湾港',
      '伊洛伊洛港',
      '八打雁港',
      '卡加延德奥罗港',
    ],
  },
  {
    name: '印度尼西亚',
    enName: 'Indonesia',
    aliases: ['indonesia', 'id', 'ina', 'IDN', '印尼', '印尼专线'],
    defaultPort: '丹戎不碌港',
    ports: [
      '丹戎不碌港',
      '雅加达港',
      '泗水港',
      '棉兰港 (勿老湾)',
      '三宝垄港',
      '望加锡港',
      '巨港港',
      '坤甸港',
    ],
  },
  {
    name: '泰国',
    enName: 'Thailand',
    aliases: ['thailand', 'th', 'tha', 'THA', '泰国专线'],
    defaultPort: '林查班港',
    ports: [
      '林查班港',
      '曼谷港',
      '兰差邦港',
      '宋卡港',
      '普吉港',
    ],
  },
  {
    name: '马来西亚',
    enName: 'Malaysia',
    aliases: ['malaysia', 'my', 'mys', 'MYS', '大马', '马来', '马来西亚专线'],
    defaultPort: '巴生港',
    ports: [
      '巴生港',
      '巴生北港',
      '巴生西港',
      '槟城港',
      '柔佛港 (巴西古当)',
      '关丹港',
      '山打根港',
      '古晋港',
    ],
  },
  {
    name: '越南',
    enName: 'Vietnam',
    aliases: ['vietnam', 'vn', 'vnm', 'VNM', '越南专线'],
    defaultPort: '胡志明港',
    ports: [
      '胡志明港 (卡莱)',
      '海防港',
      '岘港港',
      '归仁港',
      '头顿港',
    ],
  },
  {
    name: '新加坡',
    enName: 'Singapore',
    aliases: ['singapore', 'sg', 'sgp', 'SGP', '新加坡专线'],
    defaultPort: '新加坡港',
    ports: [
      '新加坡港',
      '裕廊港',
    ],
  },
  {
    name: '缅甸',
    enName: 'Myanmar',
    aliases: ['myanmar', 'mm', 'mmr', 'MMR', '缅甸专线'],
    defaultPort: '仰光港',
    ports: [
      '仰光港',
      '土瓦港',
      '皎漂港',
    ],
  },
  {
    name: '柬埔寨',
    enName: 'Cambodia',
    aliases: ['cambodia', 'kh', 'khm', 'KHM', '柬埔寨专线'],
    defaultPort: '西哈努克港',
    ports: [
      '西哈努克港',
      '金边港',
    ],
  },
  {
    name: '老挝',
    enName: 'Laos',
    aliases: ['laos', 'la', 'lao', 'LAO', '老挝专线'],
    defaultPort: '万象内陆港',
    ports: [
      '万象内陆港',
      '沙湾拿吉港',
    ],
  },
  {
    name: '文莱',
    enName: 'Brunei',
    aliases: ['brunei', 'bn', 'brn', 'BRN', '文莱专线'],
    defaultPort: '摩拉港',
    ports: [
      '摩拉港',
      '斯里巴加湾港',
    ],
  },
];

/**
 * 根据目的国名称或代码获取预设港口列表
 */
export function getPortsByCountry(countryStr?: string): string[] {
  if (!countryStr) return [];
  const normalized = countryStr.trim().toLowerCase();
  
  const found = DESTINATION_COUNTRIES.find((c) => {
    if (c.name === countryStr || c.enName.toLowerCase() === normalized) return true;
    return c.aliases.some((a) => a.toLowerCase() === normalized);
  });

  return found ? found.ports : [];
}

/**
 * 根据目的国获取默认首选港口
 */
export function getDefaultPortByCountry(countryStr?: string): string {
  if (!countryStr) return '';
  const normalized = countryStr.trim().toLowerCase();
  
  const found = DESTINATION_COUNTRIES.find((c) => {
    if (c.name === countryStr || c.enName.toLowerCase() === normalized) return true;
    return c.aliases.some((a) => a.toLowerCase() === normalized);
  });

  return found ? found.defaultPort : '';
}

/**
 * 常用国内起运仓库列表
 */
export const ORIGIN_WAREHOUSES = [
  { value: '广州', label: '广州仓 (集拼中心)' },
  { value: '龙岩', label: '龙岩仓 (闽西直发)' },
  { value: '义乌', label: '义乌仓 (小商品中心)' },
  { value: '深圳', label: '深圳仓 (大湾区专线)' },
  { value: '宁波', label: '宁波仓 (华东集港)' },
  { value: '泉州', label: '泉州仓 (鞋服产业带)' },
];

/**
 * 常用国内起运港口
 */
export const ORIGIN_PORTS = [
  '广州南沙港',
  '厦门港',
  '深圳蛇口港',
  '深圳盐田港',
  '宁波港',
  '天津港',
  '上海港',
  '青岛港',
];

/**
 * 所有目的港集合 (扁平列表，用于通用搜索或集装箱筛选)
 */
export const ALL_DESTINATION_PORTS = Array.from(
  new Set(DESTINATION_COUNTRIES.flatMap((c) => c.ports))
);
