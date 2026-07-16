import type { OHLCVBar } from "./types"

const BASE_PRICES: Record<string, number> = {
  NIFTY: 18000, BANKNIFTY: 40000, RELIANCE: 2500, TCS: 3500, INFY: 1500,
  HDFCBANK: 1600, ICICIBANK: 900, SBIN: 600, ITC: 450, TATAMOTORS: 600,
}

const INSTRUMENTS = [
  "NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY",
  "HDFCBANK", "ICICIBANK", "SBIN", "ITC", "TATAMOTORS",
]

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

export function listInstruments(): string[] {
  return [...INSTRUMENTS]
}

export function listDataSources(): string[] {
  return ["synthetic", "csv"]
}
