import type { OHLCVBar, Timeframe } from "./types"

const BASE_PRICES: Record<string, number> = {
  NIFTY: 18000, BANKNIFTY: 40000, RELIANCE: 2500, TCS: 3500, INFY: 1500,
  HDFCBANK: 1600, ICICIBANK: 900, SBIN: 600, ITC: 450, TATAMOTORS: 600,
}

const INSTRUMENTS = [
  "NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY",
  "HDFCBANK", "ICICIBANK", "SBIN", "ITC", "TATAMOTORS",
]

const YAHOO_SYMBOLS: Record<string, string> = {
  NIFTY: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  RELIANCE: "RELIANCE.NS",
  TCS: "TCS.NS",
  INFY: "INFY.NS",
  HDFCBANK: "HDFCBANK.NS",
  ICICIBANK: "ICICIBANK.NS",
  SBIN: "SBIN.NS",
  ITC: "ITC.NS",
  TATAMOTORS: "TATAMOTORS.NS",
}

const TIMEFRAME_TO_YAHOO: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "1d": "1d",
  "1w": "1wk",
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getBusinessDays(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) {
      dates.push(cur.toISOString().split("T")[0])
    }
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export async function fetchYahooData(
  instrument: string,
  startDate: string,
  endDate: string,
  timeframe: string = "1d",
): Promise<OHLCVBar[]> {
  const symbol = YAHOO_SYMBOLS[instrument.toUpperCase()]
  if (!symbol) {
    throw new Error(`Unknown instrument: ${instrument}. Available: ${INSTRUMENTS.join(", ")}`)
  }

  const interval = TIMEFRAME_TO_YAHOO[timeframe] || "1d"
  const period1 = Math.floor(new Date(startDate).getTime() / 1000)
  const period2 = Math.floor(new Date(endDate).getTime() / 1000)

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}`

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    throw new Error(`Yahoo Finance API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const chart = data.chart?.result?.[0]
  if (!chart) {
    throw new Error(`No data returned for ${instrument}`)
  }

  const timestamps: number[] = chart.timestamp || []
  const quote = chart.indicators?.quote?.[0]
  if (!quote || !quote.close) {
    throw new Error(`No OHLCV data for ${instrument}`)
  }

  const bars: OHLCVBar[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = quote.close[i]
    const open = quote.open[i]
    const high = quote.high[i]
    const low = quote.low[i]
    const volume = quote.volume[i]

    if (close == null || open == null || high == null || low == null) continue

    const dt = new Date(timestamps[i] * 1000)
    const dateStr = dt.toISOString().split("T")[0]

    bars.push({
      datetime: dateStr + "T09:15:00",
      Open: Math.round(open * 100) / 100,
      High: Math.round(high * 100) / 100,
      Low: Math.round(low * 100) / 100,
      Close: Math.round(close * 100) / 100,
      Volume: volume || 0,
    })
  }

  if (bars.length === 0) {
    throw new Error(`No valid OHLCV bars for ${instrument} in the given date range`)
  }

  return bars
}

export function generateSyntheticData(
  instrument: string,
  startDate: string,
  endDate: string,
): OHLCVBar[] {
  const rand = seededRandom(hashString(instrument))
  const dates = getBusinessDays(startDate, endDate)
  const n = dates.length
  const base = BASE_PRICES[instrument] || 1000

  const drift = 0.0003
  const volatility = 0.015
  const returns: number[] = []
  for (let i = 0; i < n; i++) {
    const u1 = rand(), u2 = rand()
    const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2)
    returns.push(drift + volatility * z)
  }

  const closeArr: number[] = []
  let cumRet = 0
  for (let i = 0; i < n; i++) {
    cumRet += returns[i]
    closeArr.push(base * Math.exp(cumRet))
  }

  const bars: OHLCVBar[] = []
  for (let i = 0; i < n; i++) {
    const close = closeArr[i]
    const dailyRange = close * (0.005 + rand() * 0.02)
    const high = close + dailyRange * (0.3 + rand() * 0.5)
    const low = close - dailyRange * (0.3 + rand() * 0.5)
    const open = low + (high - low) * (0.2 + rand() * 0.6)
    const volume = Math.floor(100000 + rand() * 4900000)

    bars.push({
      datetime: dates[i] + "T09:15:00",
      Open: Math.round(open * 100) / 100,
      High: Math.round(Math.max(high, open, close) * 100) / 100,
      Low: Math.round(Math.min(low, open, close) * 100) / 100,
      Close: Math.round(close * 100) / 100,
      Volume: volume,
    })
  }
  return bars
}

export async function fetchYahooQuote(instrument: string): Promise<{ price: number; change: number; changePercent: number; marketState: string }> {
  const symbol = YAHOO_SYMBOLS[instrument.toUpperCase()]
  if (!symbol) throw new Error(`Unknown instrument: ${instrument}`)

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Yahoo quote error: ${res.status}`)

  const data = await res.json()
  const meta = data.chart?.result?.[0]?.meta
  if (!meta) throw new Error(`No quote data for ${instrument}`)

  return {
    price: meta.regularMarketPrice ?? 0,
    change: meta.regularMarketChange ?? 0,
    changePercent: meta.regularMarketChangePercent ?? 0,
    marketState: meta.marketState ?? "UNKNOWN",
  }
}

export function listInstruments(): string[] {
  return [...INSTRUMENTS]
}

export function listDataSources(): string[] {
  return ["yahoo", "synthetic"]
}
