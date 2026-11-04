import { Router } from "express";
import { isAuthenticated } from "../auth";

export const marketRouter = Router();

const ETF_SYMBOLS = [
  { symbol: "XIU.TO", name: "iShares S&P/TSX 60" },
  { symbol: "XIC.TO", name: "iShares S&P/TSX Composite" },
  { symbol: "VCN.TO", name: "Vanguard FTSE Canada" },
  { symbol: "XBB.TO", name: "iShares Core Canadian Bond" },
  { symbol: "ZAG.TO", name: "BMO Aggregate Bond" },
  { symbol: "XRE.TO", name: "iShares Canadian REIT" },
];

const STOCK_SYMBOLS = [
  { symbol: "RY.TO", name: "Royal Bank" },
  { symbol: "TD.TO", name: "TD Bank" },
  { symbol: "BNS.TO", name: "Scotiabank" },
  { symbol: "BMO.TO", name: "BMO Financial" },
  { symbol: "ENB.TO", name: "Enbridge" },
  { symbol: "CNR.TO", name: "CN Rail" },
  { symbol: "SU.TO", name: "Suncor Energy" },
  { symbol: "BCE.TO", name: "BCE Inc" },
];

// Static fallback — realistic Canadian market snapshot (May 2025)
const STATIC_FALLBACK: Record<
  string,
  Record<string, { price: number; change: number; changePercent: number }>
> = {
  funds: {
    "XIU.TO": { price: 37.82, change: 0.14, changePercent: 0.37 },
    "XIC.TO": { price: 40.11, change: -0.08, changePercent: -0.2 },
    "VCN.TO": { price: 49.55, change: 0.22, changePercent: 0.45 },
    "XBB.TO": { price: 28.63, change: 0.05, changePercent: 0.17 },
    "ZAG.TO": { price: 14.77, change: -0.03, changePercent: -0.2 },
    "XRE.TO": { price: 17.34, change: 0.11, changePercent: 0.64 },
  },
  stocks: {
    "RY.TO": { price: 143.28, change: 1.12, changePercent: 0.79 },
    "TD.TO": { price: 82.45, change: -0.67, changePercent: -0.81 },
    "BNS.TO": { price: 66.32, change: 0.34, changePercent: 0.51 },
    "BMO.TO": { price: 124.11, change: -0.88, changePercent: -0.7 },
    "ENB.TO": { price: 58.74, change: 0.21, changePercent: 0.36 },
    "CNR.TO": { price: 155.6, change: 1.44, changePercent: 0.93 },
    "SU.TO": { price: 55.83, change: -0.29, changePercent: -0.52 },
    "BCE.TO": { price: 31.47, change: -0.15, changePercent: -0.47 },
  },
};

interface MarketQuoteCache {
  data: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
  }>;
  timestamp: number;
  live: boolean;
}

const marketCache: Record<string, MarketQuoteCache> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 min

async function fetchYahooQuotes(symbols: typeof ETF_SYMBOLS) {
  const tickers = symbols.map((s) => s.symbol).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(tickers)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CompassCRM/1.0)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);
  const json = (await res.json()) as any;
  const quotes = json?.quoteResponse?.result ?? [];
  return quotes as Array<{
    symbol: string;
    regularMarketPrice: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
  }>;
}

marketRouter.get("/quotes", isAuthenticated, async (req: any, res) => {
  const type = req.query.type === "stocks" ? "stocks" : "funds";

  // Return fresh cache if available
  if (
    marketCache[type] &&
    Date.now() - marketCache[type].timestamp < CACHE_TTL
  ) {
    return res.json(marketCache[type].data);
  }

  const symbols = type === "stocks" ? STOCK_SYMBOLS : ETF_SYMBOLS;

  try {
    const yahooData = await fetchYahooQuotes(symbols);
    const symbolMap = new Map(yahooData.map((q) => [q.symbol, q]));

    const results = symbols.map((s) => {
      const q = symbolMap.get(s.symbol);
      const fb = STATIC_FALLBACK[type][s.symbol];
      return {
        symbol: s.symbol,
        name: s.name,
        price: q?.regularMarketPrice ?? fb?.price ?? 0,
        change: q?.regularMarketChange ?? fb?.change ?? 0,
        changePercent: q?.regularMarketChangePercent ?? fb?.changePercent ?? 0,
        live: q != null,
      };
    });

    const live = results.some((r) => (r as any).live);
    marketCache[type] = { data: results, timestamp: Date.now(), live };
    return res.json(results);
  } catch (err) {
    console.warn(
      "[market] Yahoo Finance fetch failed, using fallback:",
      (err as Error).message,
    );

    // Always return something — use stale cache first, then static fallback
    if (marketCache[type]) {
      return res.json(marketCache[type].data);
    }

    const fallback = symbols.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      ...(STATIC_FALLBACK[type][s.symbol] ?? {
        price: 0,
        change: 0,
        changePercent: 0,
      }),
      live: false,
    }));

    return res.json(fallback);
  }
});
