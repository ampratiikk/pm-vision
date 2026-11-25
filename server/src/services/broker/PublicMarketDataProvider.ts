import { ChartCandleTick, MarketTick } from '@pm-vision/shared';

const IST_OFFSET_SECONDS = 19800;

export interface PublicHistoryResult {
  candles: ChartCandleTick[];
  regularMarketPrice?: number;
  previousClose?: number;
}

interface ResolutionSpec {
  yahooInterval: string;
  range: string;
  aggregateSeconds: number;
  isIntraday: boolean;
}

export class PublicMarketDataProvider {
  private quoteCache = new Map<string, { quote: MarketTick; cachedAt: number }>();
  private readonly quoteTtlMs = 3000;

  /**
   * Maps any PM Vision / NSE symbol name to Yahoo Finance ticker format.
   */
  public toYahooSymbol(symbol: string): string {
    const clean = symbol
      .trim()
      .toUpperCase()
      .replace(/^NSE:/, '')
      .replace(/-EQ$/, '')
      .replace(/-INDEX$/, '');

    const indexMap: Record<string, string> = {
      'NIFTY 50': '^NSEI',
      'NIFTY': '^NSEI',
      'NIFTY50': '^NSEI',
      'NIFTY FUT-I': '^NSEI',
      'NIFTY FUT-II': '^NSEI',
      'NIFTY FUT-III': '^NSEI',
      'NIFTY BANK': '^NSEBANK',
      'BANK NIFTY': '^NSEBANK',
      'BANKNIFTY': '^NSEBANK',
      'NIFTY IT': '^CNXIT',
      'NIFTY FIN SERVICE': 'NIFTY_FIN_SERVICE.NS',
      'FINNIFTY': 'NIFTY_FIN_SERVICE.NS',
      'NIFTY AUTO': '^CNXAUTO',
      'NIFTY FMCG': '^CNXFMCG',
      'NIFTY METAL': '^CNXMETAL',
      'NIFTY PHARMA': '^CNXPHARMA',
      'NIFTY ENERGY': '^CNXENERGY',
      'NIFTY MEDIA': '^CNXMEDIA',
      'NIFTY REALTY': '^CNXREALTY',
      'NIFTY INFRA': '^CNXINFRA',
      'NIFTY MIDCAP 50': '^NSEMDCP50',
      'NIFTY NEXT 50': '^NSMIDCP',
      'INDIA VIX': '^INDIAVIX'
    };

    if (indexMap[clean]) {
      return indexMap[clean];
    }

    if (clean.startsWith('^') || clean.endsWith('.NS') || clean.endsWith('.BO')) {
      return clean;
    }

    return `${clean}.NS`;
  }

  private getResolutionSpec(resolution: string): ResolutionSpec {
    const resClean = (resolution || '15m').toLowerCase().trim();

    if (resClean === '1m' || resClean === '1') {
      return { yahooInterval: '1m', range: '5d', aggregateSeconds: 0, isIntraday: true };
    }
    if (resClean === '2m' || resClean === '2') {
      return { yahooInterval: '2m', range: '5d', aggregateSeconds: 0, isIntraday: true };
    }
    if (resClean === '3m' || resClean === '3') {
      return { yahooInterval: '1m', range: '5d', aggregateSeconds: 180, isIntraday: true };
    }
    if (resClean === '5m' || resClean === '5') {
      return { yahooInterval: '5m', range: '1mo', aggregateSeconds: 0, isIntraday: true };
    }
    if (resClean === '10m' || resClean === '10') {
      return { yahooInterval: '5m', range: '1mo', aggregateSeconds: 600, isIntraday: true };
    }
    if (resClean === '15m' || resClean === '15') {
      return { yahooInterval: '15m', range: '1mo', aggregateSeconds: 0, isIntraday: true };
    }
    if (resClean === '30m' || resClean === '30') {
      return { yahooInterval: '30m', range: '1mo', aggregateSeconds: 0, isIntraday: true };
    }
    if (resClean === '1h' || resClean === '60') {
      return { yahooInterval: '60m', range: '3mo', aggregateSeconds: 0, isIntraday: true };
    }
    if (resClean === '2h' || resClean === '120') {
      return { yahooInterval: '60m', range: '3mo', aggregateSeconds: 7200, isIntraday: true };
    }
    if (resClean === '4h' || resClean === '240') {
      return { yahooInterval: '60m', range: '3mo', aggregateSeconds: 14400, isIntraday: true };
    }
    return { yahooInterval: '1d', range: '1y', aggregateSeconds: 0, isIntraday: false };
  }

  /**
   * Aggregates intraday bars cleanly aligned to NSE 09:15 IST market open per trading day.
   */
  private aggregateBars(bars: ChartCandleTick[], bucketSeconds: number): ChartCandleTick[] {
    if (bucketSeconds <= 0 || bars.length === 0) return bars;

    const bucketMap = new Map<number, ChartCandleTick>();
    const marketOpenOffsetSec = 9 * 3600 + 15 * 60; // 09:15 IST within IST day

    for (const bar of bars) {
      const t = Number(bar.time);
      const dayStart = Math.floor(t / 86400) * 86400;
      const sessionStart = dayStart + marketOpenOffsetSec;
      const elapsed = Math.max(0, t - sessionStart);
      const bucketTime = sessionStart + Math.floor(elapsed / bucketSeconds) * bucketSeconds;

      const existing = bucketMap.get(bucketTime);
      if (!existing) {
        bucketMap.set(bucketTime, {
          time: bucketTime,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume || 0
        });
      } else {
        existing.high = parseFloat(Math.max(existing.high, bar.high).toFixed(2));
        existing.low = parseFloat(Math.min(existing.low, bar.low).toFixed(2));
        existing.close = bar.close;
        existing.volume = (existing.volume || 0) + (bar.volume || 0);
      }
    }

    return Array.from(bucketMap.values()).sort((a, b) => Number(a.time) - Number(b.time));
  }

  /**
   * Fetch genuine NSE historical candles + metadata for any timeframe and symbol.
   */
  public async fetchHistoryWithMeta(
    resolution: string = '15m',
    symbol: string = 'NIFTY 50'
  ): Promise<PublicHistoryResult> {
    const yahooSym = this.toYahooSymbol(symbol);
    const spec = this.getResolutionSpec(resolution);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${spec.range}&interval=${spec.yahooInterval}&includePrePost=false`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) {
        return { candles: [] };
      }

      const json: any = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result || !Array.isArray(result.timestamp) || !result.indicators?.quote?.[0]) {
        return { candles: [] };
      }

      const timestamps: number[] = result.timestamp;
      const quote = result.indicators.quote[0];
      const opens: Array<number | null> = quote.open || [];
      const highs: Array<number | null> = quote.high || [];
      const lows: Array<number | null> = quote.low || [];
      const closes: Array<number | null> = quote.close || [];
      const volumes: Array<number | null> = quote.volume || [];

      const candleMap = new Map<number, ChartCandleTick>();

      for (let i = 0; i < timestamps.length; i++) {
        const epoch = timestamps[i];
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        const v = volumes[i] || 0;

        if (
          typeof epoch !== 'number' ||
          o === null || h === null || l === null || c === null ||
          !isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c) ||
          o <= 0 || h <= 0 || l <= 0 || c <= 0
        ) {
          continue;
        }

        const timeVal = epoch + IST_OFFSET_SECONDS;
        const dIst = new Date(timeVal * 1000);
        const istHr = dIst.getUTCHours();
        const istMin = dIst.getUTCMinutes();

        // Skip zero-volume flat closing snapshot tick emitted right at 15:30:00 after market close
        if (spec.isIntraday && istHr === 15 && istMin === 30 && v === 0 && o === h && h === l && l === c) {
          continue;
        }

        candleMap.set(timeVal, {
          time: timeVal,
          open: parseFloat(Number(o).toFixed(2)),
          high: parseFloat(Number(h).toFixed(2)),
          low: parseFloat(Number(l).toFixed(2)),
          close: parseFloat(Number(c).toFixed(2)),
          volume: Number(v) || 0
        });
      }

      let candles = Array.from(candleMap.values()).sort((a, b) => Number(a.time) - Number(b.time));
      if (spec.aggregateSeconds > 0) {
        candles = this.aggregateBars(candles, spec.aggregateSeconds);
      }

      const meta = result.meta || {};
      const regularMarketPrice = typeof meta.regularMarketPrice === 'number' ? parseFloat(meta.regularMarketPrice.toFixed(2)) : undefined;
      const previousClose = typeof meta.chartPreviousClose === 'number'
        ? parseFloat(meta.chartPreviousClose.toFixed(2))
        : (typeof meta.previousClose === 'number' ? parseFloat(meta.previousClose.toFixed(2)) : undefined);

      return { candles, regularMarketPrice, previousClose };
    } catch (err) {
      console.warn(`[PublicDataProvider] History fetch failed for ${symbol} (${yahooSym}):`, err);
      return { candles: [] };
    }
  }

  public async fetchHistory(resolution: string = '15m', symbol: string = 'NIFTY 50'): Promise<ChartCandleTick[]> {
    const res = await this.fetchHistoryWithMeta(resolution, symbol);
    return res.candles;
  }

  /**
   * Fetch latest quote for a single symbol with short-lived cache to avoid redundant upstream requests.
   */
  public async fetchSingleQuote(symbol: string): Promise<MarketTick | null> {
    const cleanSym = symbol.trim().toUpperCase();
    const cached = this.quoteCache.get(cleanSym);
    if (cached && Date.now() - cached.cachedAt < this.quoteTtlMs) {
      return cached.quote;
    }

    const yahooSym = this.toYahooSymbol(cleanSym);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=1d&interval=5m&includePrePost=false`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!res.ok) return null;

      const json: any = await res.json();
      const result = json?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta || typeof meta.regularMarketPrice !== 'number' || meta.regularMarketPrice <= 0) {
        return null;
      }

      const ltp = parseFloat(meta.regularMarketPrice.toFixed(2));
      const prevClose = typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0
        ? meta.chartPreviousClose
        : (typeof meta.previousClose === 'number' && meta.previousClose > 0 ? meta.previousClose : ltp);

      const change = parseFloat((ltp - prevClose).toFixed(2));
      const changePct = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

      const quoteBars = result?.indicators?.quote?.[0];
      let open = typeof meta.regularMarketOpen === 'number' && meta.regularMarketOpen > 0 ? meta.regularMarketOpen : ltp;
      let high = typeof meta.regularMarketDayHigh === 'number' && meta.regularMarketDayHigh > 0 ? meta.regularMarketDayHigh : ltp;
      let low = typeof meta.regularMarketDayLow === 'number' && meta.regularMarketDayLow > 0 ? meta.regularMarketDayLow : ltp;
      let vwap = ltp;
      let totalVol = typeof meta.regularMarketVolume === 'number' ? meta.regularMarketVolume : 0;

      if (quoteBars && Array.isArray(quoteBars.close)) {
        let validHigh = -Infinity;
        let validLow = Infinity;
        let firstOpen: number | null = null;
        let cumTypVol = 0;
        let cumVol = 0;

        for (let i = 0; i < quoteBars.close.length; i++) {
          const o = quoteBars.open?.[i];
          const h = quoteBars.high?.[i];
          const l = quoteBars.low?.[i];
          const c = quoteBars.close?.[i];
          const v = quoteBars.volume?.[i] || 0;
          if (o && h && l && c && isFinite(o) && isFinite(h) && isFinite(l) && isFinite(c)) {
            if (firstOpen === null) firstOpen = o;
            if (h > validHigh) validHigh = h;
            if (l < validLow) validLow = l;
            const tp = (h + l + c) / 3;
            const w = v > 0 ? v : 1;
            cumTypVol += tp * w;
            cumVol += w;
          }
        }

        if (firstOpen !== null && !meta.regularMarketOpen) open = firstOpen;
        if (validHigh > -Infinity && !meta.regularMarketDayHigh) high = validHigh;
        if (validLow < Infinity && !meta.regularMarketDayLow) low = validLow;
        if (cumVol > 0) vwap = cumTypVol / cumVol;
      }

      const volFormatted = totalVol >= 1_000_000
        ? `${(totalVol / 1_000_000).toFixed(1)}M`
        : totalVol >= 1000
          ? `${(totalVol / 1000).toFixed(0)}K`
          : '—';

      const tick: MarketTick = {
        id: cleanSym.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: meta.shortName || meta.longName || cleanSym,
        symbol: cleanSym,
        ltp,
        change,
        changePct,
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        open: parseFloat(open.toFixed(2)),
        vwap: parseFloat(vwap.toFixed(2)),
        volume: volFormatted
      };

      this.quoteCache.set(cleanSym, { quote: tick, cachedAt: Date.now() });
      return tick;
    } catch {
      return null;
    }
  }

  /**
   * Batch fetch quotes with bounded concurrency (max 8 concurrent requests).
   */
  public async fetchQuotes(symbols: string[]): Promise<MarketTick[]> {
    const unique = Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)));
    const results: MarketTick[] = [];
    const batchSize = 8;

    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize);
      const settled = await Promise.allSettled(batch.map((sym) => this.fetchSingleQuote(sym)));
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) {
          results.push(r.value);
        }
      }
    }

    return results;
  }
}
