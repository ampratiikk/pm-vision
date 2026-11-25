import {
  MasterInstrument,
  InstrumentCatalogResponse,
  FuturesMonthRole
} from '@pm-vision/shared';

const INDEX_FUT_UNDERLYINGS = new Set([
  'NIFTY',
  'BANKNIFTY',
  'FINNIFTY',
  'MIDCPNIFTY',
  'NIFTYNXT50'
]);

const KNOWN_INDEX_ALIASES: Record<string, { symbol: string; name: string; priority: number }> = {
  'NSE:NIFTY50-INDEX': { symbol: 'NIFTY 50', name: 'Nifty 50 Index', priority: 1 },
  'NSE:NIFTYBANK-INDEX': { symbol: 'NIFTY BANK', name: 'Nifty Bank Index', priority: 2 },
  'NSE:FINNIFTY-INDEX': { symbol: 'NIFTY FIN SERVICE', name: 'Nifty Financial Services Index', priority: 3 },
  'NSE:NIFTYNEXT50-INDEX': { symbol: 'NIFTY NEXT 50', name: 'Nifty Next 50 Index', priority: 4 },
  'NSE:NIFTYMIDCAP50-INDEX': { symbol: 'NIFTY MIDCAP 50', name: 'Nifty Midcap 50 Index', priority: 5 },
  'NSE:NIFTYIT-INDEX': { symbol: 'NIFTY IT', name: 'Nifty IT Index', priority: 6 },
  'NSE:NIFTYAUTO-INDEX': { symbol: 'NIFTY AUTO', name: 'Nifty Auto Index', priority: 7 },
  'NSE:NIFTYFMCG-INDEX': { symbol: 'NIFTY FMCG', name: 'Nifty FMCG Index', priority: 8 },
  'NSE:NIFTYMETAL-INDEX': { symbol: 'NIFTY METAL', name: 'Nifty Metal Index', priority: 9 },
  'NSE:NIFTYPHARMA-INDEX': { symbol: 'NIFTY PHARMA', name: 'Nifty Pharma Index', priority: 10 },
  'NSE:NIFTYREALTY-INDEX': { symbol: 'NIFTY REALTY', name: 'Nifty Realty Index', priority: 11 },
  'NSE:NIFTYENERGY-INDEX': { symbol: 'NIFTY ENERGY', name: 'Nifty Energy Index', priority: 12 },
  'NSE:NIFTYINFRA-INDEX': { symbol: 'NIFTY INFRA', name: 'Nifty Infrastructure Index', priority: 13 },
  'NSE:NIFTYMEDIA-INDEX': { symbol: 'NIFTY MEDIA', name: 'Nifty Media Index', priority: 14 },
  'NSE:INDIAVIX-INDEX': { symbol: 'INDIA VIX', name: 'India Volatility Index', priority: 15 }
};

function formatDateDisplay(epochSec: number): { isoDate: string; label: string } {
  const ist = new Date((epochSec + 19800) * 1000);
  const isoDate = ist.toISOString().slice(0, 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const mon = months[ist.getUTCMonth()] || '';
  const yr = String(ist.getUTCFullYear()).slice(-2);
  return { isoDate, label: `${day} ${mon} ${yr}` };
}

export class SymbolMasterService {
  private equities: MasterInstrument[] = [];
  private indices: MasterInstrument[] = [];
  private futures: MasterInstrument[] = [];
  private fnOUnderlyings: Set<string> = new Set();

  // Fast O(1) resolution lookup maps (key = upper-case symbol / alias / fyersSymbol)
  private lookupMap = new Map<string, MasterInstrument>();
  private niftyContracts: { current?: MasterInstrument; next?: MasterInstrument; far?: MasterInstrument } = {};

  private lastLoadedAt: number = 0;
  private loadingPromise: Promise<void> | null = null;
  private readonly refreshIntervalMs = 12 * 60 * 60 * 1000; // Refresh every 12h

  constructor() {
    this.ensureLoaded().catch(() => {});
  }

  public async ensureLoaded(): Promise<void> {
    if (this.lastLoadedAt > 0 && Date.now() - this.lastLoadedAt < this.refreshIntervalMs) {
      return;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }
    this.loadingPromise = this.loadFromFyersMasters().finally(() => {
      this.loadingPromise = null;
    });
    return this.loadingPromise;
  }

  private async loadFromFyersMasters(): Promise<void> {
    try {
      const [foRes, cmRes] = await Promise.all([
        fetch('https://public.fyers.in/sym_details/NSE_FO.csv', {
          signal: AbortSignal.timeout(15000)
        }),
        fetch('https://public.fyers.in/sym_details/NSE_CM.csv', {
          signal: AbortSignal.timeout(15000)
        })
      ]);

      if (!foRes.ok || !cmRes.ok) {
        console.warn('[SymbolMaster] Upstream master CSV fetch returned non-ok status.');
        return;
      }

      const [foCsv, cmCsv] = await Promise.all([foRes.text(), cmRes.text()]);

      const nextFutures: MasterInstrument[] = [];
      const nextEquities: MasterInstrument[] = [];
      const nextIndices: MasterInstrument[] = [];
      const nextFnoSet = new Set<string>();
      const nextLookup = new Map<string, MasterInstrument>();
      const nextNiftyContracts: { current?: MasterInstrument; next?: MasterInstrument; far?: MasterInstrument } = {};

      // 1. Parse NSE_FO.csv for ALL Active Index & Stock Futures
      const futByUnderlying = new Map<
        string,
        Array<{
          fyersSymbol: string;
          rawName: string;
          lotSize: number;
          expiryEpoch: number;
          underlying: string;
        }>
      >();

      const foLines = foCsv.split('\n');
      const minActiveEpoch = Math.floor(Date.now() / 1000) - 86400; // allow today's expiry through close

      for (const line of foLines) {
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length < 14) continue;
        const fyersSym = cols[9]?.trim();
        const instrType = cols[2]?.trim();
        if (!fyersSym || (instrType !== '11' && !fyersSym.endsWith('FUT'))) continue;

        const underlying = (cols[13] || '').trim().toUpperCase();
        const expiryEpoch = Number(cols[8]) || 0;
        if (!underlying || expiryEpoch < minActiveEpoch) continue;

        const lotSize = Number(cols[3]) || 1;
        const rawName = (cols[1] || fyersSym).trim();

        if (!futByUnderlying.has(underlying)) {
          futByUnderlying.set(underlying, []);
        }
        futByUnderlying.get(underlying)!.push({
          fyersSymbol: fyersSym,
          rawName,
          lotSize,
          expiryEpoch,
          underlying
        });
      }

      const sortedUnderlyings = Array.from(futByUnderlying.keys()).sort((a, b) => {
        const aIdx = INDEX_FUT_UNDERLYINGS.has(a) ? 0 : 1;
        const bIdx = INDEX_FUT_UNDERLYINGS.has(b) ? 0 : 1;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.localeCompare(b);
      });

      const roles: FuturesMonthRole[] = ['CURRENT', 'NEXT', 'FAR'];
      const roleLabels: Record<FuturesMonthRole, string> = {
        CONTINUOUS: 'Continuous (1!)',
        CURRENT: 'Current Month',
        NEXT: 'Next Month',
        FAR: 'Far Month'
      };

      for (const underlying of sortedUnderlyings) {
        nextFnoSet.add(underlying);
        const list = futByUnderlying.get(underlying)!;
        // Deduplicate by fyersSymbol & sort chronologically
        const seenSym = new Set<string>();
        const sortedContracts = list
          .filter((c) => {
            if (seenSym.has(c.fyersSymbol)) return false;
            seenSym.add(c.fyersSymbol);
            return true;
          })
          .sort((a, b) => a.expiryEpoch - b.expiryEpoch)
          .slice(0, 3);

        if (sortedContracts.length === 0) continue;

        const isIndexFut = INDEX_FUT_UNDERLYINGS.has(underlying);
        const cat = isIndexFut ? 'INDEX_FUTURES' : 'STOCK_FUTURES';

        // Continuous future contract (1!) tied dynamically to Front/Current month contract + cont_flag=1
        const near = sortedContracts[0];
        const nearExp = formatDateDisplay(near.expiryEpoch);
        const contInst: MasterInstrument = {
          symbol: `${underlying}1!`,
          displaySymbol: `${underlying}1!`,
          name: `${underlying} Continuous Futures (1!)`,
          fyersSymbol: near.fyersSymbol,
          underlying,
          category: cat,
          futuresRole: 'CONTINUOUS',
          expiryDate: nearExp.isoDate,
          expiryLabel: `Continuous · ${nearExp.label}`,
          lotSize: near.lotSize,
          isFnO: true,
          contFlag: true
        };
        nextFutures.push(contInst);
        nextLookup.set(contInst.symbol.toUpperCase(), contInst);

        // Separate Current / Next / Far monthly contracts
        sortedContracts.forEach((c, idx) => {
          const role = roles[idx] || 'FAR';
          const bareSym = c.fyersSymbol.replace(/^NSE:/, '');
          const { isoDate, label } = formatDateDisplay(c.expiryEpoch);
          const inst: MasterInstrument = {
            symbol: bareSym,
            displaySymbol: bareSym,
            name: `${underlying} ${label} Futures (${roleLabels[role]})`,
            fyersSymbol: c.fyersSymbol,
            underlying,
            category: cat,
            futuresRole: role,
            expiryDate: isoDate,
            expiryLabel: label,
            lotSize: c.lotSize,
            isFnO: true,
            contFlag: false
          };
          nextFutures.push(inst);
          nextLookup.set(bareSym.toUpperCase(), inst);
          nextLookup.set(c.fyersSymbol.toUpperCase(), inst);
          nextLookup.set(c.rawName.toUpperCase(), inst);

          if (underlying === 'NIFTY') {
            if (idx === 0) nextNiftyContracts.current = inst;
            else if (idx === 1) nextNiftyContracts.next = inst;
            else if (idx === 2) nextNiftyContracts.far = inst;
          }
        });
      }

      // 2. Parse NSE_CM.csv for ALL Equities (-EQ) and ALL Indices (-INDEX)
      const cmLines = cmCsv.split('\n');
      const seenCm = new Set<string>();

      for (const line of cmLines) {
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length < 14) continue;
        const fyersSym = cols[9]?.trim();
        if (!fyersSym || seenCm.has(fyersSym)) continue;
        seenCm.add(fyersSym);

        const rawName = (cols[1] || '').trim();

        if (fyersSym.endsWith('-INDEX')) {
          const aliasInfo = KNOWN_INDEX_ALIASES[fyersSym];
          const bareSym = aliasInfo ? aliasInfo.symbol : fyersSym.replace(/^NSE:/, '').replace(/-INDEX$/, '');
          const dispName = aliasInfo ? aliasInfo.name : (rawName || bareSym);
          const undSym = (cols[13] || bareSym).trim().toUpperCase();
          const inst: MasterInstrument = {
            symbol: bareSym,
            displaySymbol: bareSym,
            name: dispName,
            fyersSymbol: fyersSym,
            underlying: undSym,
            category: 'INDEX',
            isFnO: nextFnoSet.has(undSym) || bareSym === 'NIFTY 50' || bareSym === 'NIFTY BANK'
          };
          nextIndices.push(inst);
          nextLookup.set(bareSym.toUpperCase(), inst);
          nextLookup.set(fyersSym.toUpperCase(), inst);
          if (undSym) nextLookup.set(undSym, inst);
        } else if (fyersSym.endsWith('-EQ')) {
          const bareSym = fyersSym.replace(/^NSE:/, '').replace(/-EQ$/, '').toUpperCase();
          const isFnO = nextFnoSet.has(bareSym);
          const inst: MasterInstrument = {
            symbol: bareSym,
            displaySymbol: bareSym,
            name: rawName || bareSym,
            fyersSymbol: fyersSym,
            underlying: bareSym,
            category: 'EQUITY',
            isFnO
          };
          nextEquities.push(inst);
          nextLookup.set(bareSym, inst);
          nextLookup.set(fyersSym.toUpperCase(), inst);
        }
      }

      // Sort indices: known primary benchmarks first, then alphabetical
      nextIndices.sort((a, b) => {
        const pa = KNOWN_INDEX_ALIASES[a.fyersSymbol]?.priority ?? 999;
        const pb = KNOWN_INDEX_ALIASES[b.fyersSymbol]?.priority ?? 999;
        if (pa !== pb) return pa - pb;
        return a.symbol.localeCompare(b.symbol);
      });

      // Sort equities: F&O stocks first, then alphabetical
      nextEquities.sort((a, b) => {
        if (a.isFnO !== b.isFnO) return a.isFnO ? -1 : 1;
        return a.symbol.localeCompare(b.symbol);
      });

      this.futures = nextFutures;
      this.equities = nextEquities;
      this.indices = nextIndices;
      this.fnOUnderlyings = nextFnoSet;
      this.lookupMap = nextLookup;
      this.niftyContracts = nextNiftyContracts;
      this.lastLoadedAt = Date.now();

      console.log(
        `[SymbolMaster] Loaded ${nextEquities.length} NSE equities, ${nextIndices.length} indices, ${nextFutures.length} future contracts (${nextFnoSet.size} F&O underlyings).`
      );
    } catch (err) {
      console.warn('[SymbolMaster] Failed to load NSE master CSVs:', err);
    }
  }

  public getCatalog(): InstrumentCatalogResponse {
    return {
      equities: this.equities,
      indices: this.indices,
      futures: this.futures,
      fnOUnderlyings: Array.from(this.fnOUnderlyings),
      updatedAt: this.lastLoadedAt > 0 ? new Date(this.lastLoadedAt).toISOString() : new Date().toISOString()
    };
  }

  public getNiftyMonthlyContracts(): { current?: MasterInstrument; next?: MasterInstrument; far?: MasterInstrument } {
    return this.niftyContracts;
  }

  /**
   * Resolve any UI / URL / FYERS symbol cleanly into an Instrument metadata record.
   */
  public resolveInstrument(symbolInput: string): {
    fyersSymbol: string;
    contFlag: boolean;
    instrument?: MasterInstrument;
  } {
    const clean = (symbolInput || 'NIFTY 50').trim().toUpperCase();

    if (clean === 'NIFTY FUT-I' && this.niftyContracts.current) {
      return {
        fyersSymbol: this.niftyContracts.current.fyersSymbol,
        contFlag: false,
        instrument: this.niftyContracts.current
      };
    }
    if (clean === 'NIFTY FUT-II' && this.niftyContracts.next) {
      return {
        fyersSymbol: this.niftyContracts.next.fyersSymbol,
        contFlag: false,
        instrument: this.niftyContracts.next
      };
    }
    if (clean === 'NIFTY FUT-III' && this.niftyContracts.far) {
      return {
        fyersSymbol: this.niftyContracts.far.fyersSymbol,
        contFlag: false,
        instrument: this.niftyContracts.far
      };
    }
    if (clean === 'BANK NIFTY') {
      const bank = this.lookupMap.get('NIFTY BANK');
      return {
        fyersSymbol: bank?.fyersSymbol || 'NSE:NIFTYBANK-INDEX',
        contFlag: false,
        instrument: bank
      };
    }

    const found = this.lookupMap.get(clean);
    if (found) {
      return {
        fyersSymbol: found.fyersSymbol,
        contFlag: Boolean(found.contFlag),
        instrument: found
      };
    }

    // Legacy / direct fallback rules
    if (clean.includes(':')) {
      return { fyersSymbol: clean, contFlag: false };
    }
    if (clean.endsWith('1!')) {
      const und = clean.slice(0, -2);
      const curr = this.futures.find((f) => f.underlying === und && f.futuresRole === 'CURRENT');
      if (curr) {
        return { fyersSymbol: curr.fyersSymbol, contFlag: true, instrument: curr };
      }
    }
    if (clean.endsWith('FUT')) {
      return { fyersSymbol: `NSE:${clean}`, contFlag: false };
    }
    if (clean === 'NIFTY 50' || clean === 'NIFTY' || clean === 'NIFTY50') {
      return { fyersSymbol: 'NSE:NIFTY50-INDEX', contFlag: false };
    }
    if (clean === 'NIFTY BANK' || clean === 'BANKNIFTY') {
      return { fyersSymbol: 'NSE:NIFTYBANK-INDEX', contFlag: false };
    }
    if (clean === 'FINNIFTY' || clean === 'NIFTY FIN SERVICE') {
      return { fyersSymbol: 'NSE:FINNIFTY-INDEX', contFlag: false };
    }
    if (clean === 'INDIA VIX') {
      return { fyersSymbol: 'NSE:INDIAVIX-INDEX', contFlag: false };
    }

    return { fyersSymbol: `NSE:${clean}-EQ`, contFlag: false };
  }
}

export const symbolMaster = new SymbolMasterService();
