export interface OHLCVBar {
  datetime: string
  Open: number
  High: number
  Low: number
  Close: number
  Volume: number
}

function sma(values: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += values[j]
    result.push(sum / period)
  }
  return result
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = NaN
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    if (i === period - 1) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += values[j]
      prev = sum / period
      result.push(prev)
      continue
    }
    prev = values[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

export function computeRSI(closes: number[], period: number = 14): number[] {
  const deltas: number[] = []
  for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i - 1])
  const gains = deltas.map(d => d > 0 ? d : 0)
  const losses = deltas.map(d => d < 0 ? -d : 0)
  const avgGains = ema(gains, period)
  const avgLosses = ema(losses, period)
  const rsi: number[] = [NaN]
  for (let i = 0; i < avgGains.length; i++) {
    if (isNaN(avgGains[i]) || isNaN(avgLosses[i]) || avgLosses[i] === 0) { rsi.push(NaN); continue }
    const rs = avgGains[i] / avgLosses[i]
    rsi.push(100 - 100 / (1 + rs))
  }
  return rsi
}

export function computeEMA(values: number[], period: number): number[] {
  return ema(values, period)
}

export function computeSMA(values: number[], period: number): number[] {
  return sma(values, period)
}

export function computeMACD(closes: number[], fast: number = 12, slow: number = 26, signal: number = 9): { macd: number[]; signal_line: number[]; histogram: number[] } {
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const macdLine = emaFast.map((v, i) => isNaN(v) || isNaN(emaSlow[i]) ? NaN : v - emaSlow[i])
  const validMacd = macdLine.map(v => isNaN(v) ? 0 : v)
  const signalLine = ema(validMacd, signal)
  const histogram = macdLine.map((v, i) => isNaN(v) || isNaN(signalLine[i]) ? NaN : v - signalLine[i])
  return { macd: macdLine, signal_line: signalLine, histogram }
}

export function computeBollingerBands(closes: number[], period: number = 20, stdDev: number = 2.0): { upper: number[]; mid: number[]; lower: number[] } {
  const mid = sma(closes, period)
  const upper: number[] = []
  const lower: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || isNaN(mid[i])) { upper.push(NaN); lower.push(NaN); continue }
    let sumSq = 0
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - mid[i]) ** 2
    const std = Math.sqrt(sumSq / period)
    upper.push(mid[i] + stdDev * std)
    lower.push(mid[i] - stdDev * std)
  }
  return { upper, mid, lower }
}

export function computeATR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const tr: number[] = []
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) { tr.push(highs[i] - lows[i]); continue }
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
  }
  return ema(tr, period)
}

export function computeStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number = 14, dPeriod: number = 3): { k: number[]; d: number[] } {
  const k: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < kPeriod - 1) { k.push(NaN); continue }
    let hh = -Infinity, ll = Infinity
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j]
      if (lows[j] < ll) ll = lows[j]
    }
    const range = hh - ll
    k.push(range === 0 ? NaN : 100 * (closes[i] - ll) / range)
  }
  const d = sma(k.map(v => isNaN(v) ? 0 : v), dPeriod)
  return { k, d }
}

export function computeVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
  const result: number[] = []
  let cumTPV = 0, cumVol = 0
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3
    cumTPV += tp * volumes[i]
    cumVol += volumes[i]
    result.push(cumVol === 0 ? NaN : cumTPV / cumVol)
  }
  return result
}

export function computeSupertrend(highs: number[], lows: number[], closes: number[], period: number = 10, multiplier: number = 3.0): { supertrend: number[]; direction: number[] } {
  const atrVal = computeATR(highs, lows, closes, period)
  const hl2 = highs.map((h, i) => (h + lows[i]) / 2)
  let upperBand = hl2.map((v, i) => isNaN(atrVal[i]) ? NaN : v + multiplier * atrVal[i])
  let lowerBand = hl2.map((v, i) => isNaN(atrVal[i]) ? NaN : v - multiplier * atrVal[i])
  const supertrendVal: number[] = new Array(closes.length).fill(NaN)
  const direction: number[] = new Array(closes.length).fill(1)
  for (let i = 1; i < closes.length; i++) {
    if (isNaN(upperBand[i])) { supertrendVal[i] = NaN; continue }
    if (closes[i] > upperBand[i - 1]) direction[i] = 1
    else if (closes[i] < lowerBand[i - 1]) direction[i] = -1
    else {
      direction[i] = direction[i - 1]
      if (direction[i] === 1 && lowerBand[i] < lowerBand[i - 1]) lowerBand[i] = lowerBand[i - 1]
      if (direction[i] === -1 && upperBand[i] > upperBand[i - 1]) upperBand[i] = upperBand[i - 1]
    }
    supertrendVal[i] = direction[i] === 1 ? lowerBand[i] : upperBand[i]
  }
  return { supertrend: supertrendVal, direction }
}

export function computeADX(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const plusDM: number[] = []
  const minusDM: number[] = []
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) { plusDM.push(0); minusDM.push(0); continue }
    const up = highs[i] - highs[i - 1]
    const down = lows[i - 1] - lows[i]
    plusDM.push(up > down && up > 0 ? up : 0)
    minusDM.push(down > up && down > 0 ? down : 0)
  }
  const atrVal = computeATR(highs, lows, closes, period)
  const plusDI = ema(plusDM, period).map((v, i) => atrVal[i] === 0 || isNaN(atrVal[i]) ? NaN : 100 * v / atrVal[i])
  const minusDI = ema(minusDM, period).map((v, i) => atrVal[i] === 0 || isNaN(atrVal[i]) ? NaN : 100 * v / atrVal[i])
  const dx = plusDI.map((v, i) => {
    if (isNaN(v) || isNaN(minusDI[i])) return NaN
    const sum = v + minusDI[i]
    return sum === 0 ? NaN : 100 * Math.abs(v - minusDI[i]) / sum
  })
  return ema(dx.map(v => isNaN(v) ? 0 : v), period)
}

export type IndicatorResult = number[] | { [key: string]: number[] }

export function computeIndicator(name: string, bars: OHLCVBar[], params: Record<string, number> = {}): IndicatorResult {
  const closes = bars.map(b => b.Close)
  const highs = bars.map(b => b.High)
  const lows = bars.map(b => b.Low)
  const volumes = bars.map(b => b.Volume)
  const period = params.period || params.length || 14

  switch (name.toLowerCase()) {
    case "sma": return computeSMA(closes, period)
    case "ema": return computeEMA(closes, period)
    case "rsi": return computeRSI(closes, period)
    case "macd": return computeMACD(closes, params.fast || 12, params.slow || 26, params.signal || 9)
    case "bollinger_bands": return computeBollingerBands(closes, period, params.std_dev || 2.0)
    case "atr": return computeATR(highs, lows, closes, period)
    case "stochastic": return computeStochastic(highs, lows, closes, params.k_period || period, params.d_period || 3)
    case "vwap": return computeVWAP(highs, lows, closes, volumes)
    case "supertrend": return computeSupertrend(highs, lows, closes, period, params.multiplier || 3.0)
    case "adx": return computeADX(highs, lows, closes, period)
    default: throw new Error(`Unknown indicator: ${name}`)
  }
}

export function getIndicatorValue(result: IndicatorResult, name: string, idx: number): number {
  if (Array.isArray(result)) {
    const v = result[idx]
    return isNaN(v) ? 0 : v
  }
  if (name === "macd" && "macd" in result) {
    const v = (result as { macd: number[] }).macd[idx]
    return isNaN(v) ? 0 : v
  }
  return 0
}
