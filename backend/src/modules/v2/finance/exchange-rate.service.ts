import axios from 'axios';

export interface DailyExchangeRates {
  usdRate: number; // 1 USD = X CNY (贵币计价法)
  phpRate: number; // 1 CNY = Y PHP (贵币计价法)
  date: string;    // YYYY-MM-DD
  source: 'LIVE' | 'CACHE';
}

export class ExchangeRateService {
  private cachedRates: DailyExchangeRates | null = null;
  private cacheExpiresAt: number = 0;

  /**
   * 获取当日实时汇率 (带当日内存缓存，失败时严格抛错，禁止静默默认值兜底)
   */
  async getTodayRates(): Promise<DailyExchangeRates> {
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. 若缓存未过期且为当天，直接返回
    if (this.cachedRates && now < this.cacheExpiresAt && this.cachedRates.date === todayStr) {
      return {
        ...this.cachedRates,
        source: 'CACHE',
      };
    }

    // 2. 尝试从开放外汇 API 获取最新当日行情
    try {
      const response = await axios.get('https://open.er-api.com/v6/latest/CNY', {
        timeout: 4000,
      });

      if (response.data && response.data.result === 'success' && response.data.rates) {
        const rates = response.data.rates;
        const cnyToUsd = Number(rates.USD);
        const cnyToPhp = Number(rates.PHP);

        if (!cnyToUsd || !cnyToPhp || cnyToUsd <= 0 || cnyToPhp <= 0) {
          throw new Error('外汇接口返回汇率数值无效');
        }

        const usdRate = Math.round((1 / cnyToUsd) * 10000) / 10000;
        const phpRate = Math.round(cnyToPhp * 10000) / 10000;

        this.cachedRates = {
          usdRate,
          phpRate,
          date: todayStr,
          source: 'LIVE',
        };
        this.cacheExpiresAt = now + 6 * 60 * 60 * 1000; // 缓存 6 小时

        return this.cachedRates;
      }
      throw new Error('外汇接口返回数据结构异常，未能解析有效汇率');
    } catch (err: any) {
      console.error(`[ExchangeRateService] 获取当日外汇牌价失败: ${err.message}`);
      throw new Error(`无法获取当日外汇汇率 (${err.message})，请手动录入汇率`);
    }
  }
}

export const exchangeRateService = new ExchangeRateService();
