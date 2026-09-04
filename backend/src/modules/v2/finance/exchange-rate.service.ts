import axios from 'axios';

export interface DailyExchangeRates {
  usdRate: number; // 1 USD = X CNY (贵币计价法)
  phpRate: number; // 1 CNY = Y PHP (贵币计价法)
  date: string;    // YYYY-MM-DD
  source: 'LIVE' | 'CACHE' | 'FALLBACK';
}

const DEFAULT_RATES: DailyExchangeRates = {
  usdRate: 7.2000,
  phpRate: 8.0000,
  date: new Date().toISOString().split('T')[0],
  source: 'FALLBACK',
};

export class ExchangeRateService {
  private cachedRates: DailyExchangeRates | null = null;
  private cacheExpiresAt: number = 0;

  /**
   * 获取当日实时汇率 (带内存缓存与安全熔断兜底)
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

        let usdRate = DEFAULT_RATES.usdRate;
        let phpRate = DEFAULT_RATES.phpRate;

        if (cnyToUsd > 0) {
          usdRate = Math.round((1 / cnyToUsd) * 10000) / 10000;
        }
        if (cnyToPhp > 0) {
          phpRate = Math.round(cnyToPhp * 10000) / 10000;
        }

        this.cachedRates = {
          usdRate,
          phpRate,
          date: todayStr,
          source: 'LIVE',
        };
        this.cacheExpiresAt = now + 6 * 60 * 60 * 1000; // 缓存 6 小时

        return this.cachedRates;
      }
    } catch (err: any) {
      console.warn(`[ExchangeRateService] 自动获取当日汇率失败，已降级为安全基准值: ${err.message}`);
    }

    // 3. 熔断兜底安全返回
    return {
      ...DEFAULT_RATES,
      date: todayStr,
      source: 'FALLBACK',
    };
  }
}

export const exchangeRateService = new ExchangeRateService();
