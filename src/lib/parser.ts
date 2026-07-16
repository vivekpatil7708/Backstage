import type {
  StrategyDefinition,
  Condition,
  ConditionOperator,
  EntryRule,
  ExitRule,
  RiskManagement,
  Side,
  Timeframe,
} from "./types"

const INSTRUMENTS_KNOWN = [
  "banknifty", "nifty50", "nifty", "reliance", "tcs", "infy",
  "hdfcbank", "icicibank", "sbin", "itc", "tatamotors",
]

export function parseNaturalLanguage(prompt: string): StrategyDefinition {
  const p = prompt.toLowerCase()
  const instrument = extractInstrument(p)
  const side = extractSide(p)
  const timeframe = extractTimeframe(p)
  const conditions = extractConditions(prompt)
  const riskMgmt = extractRiskManagement(p)
  const exitRules = extractExitRules(p)

  const entryRule: EntryRule = {
    conditions: conditions.length > 0 ? conditions : [
      { indicator: "sma", operator: "cross_above" as ConditionOperator, value: 20, period: 20 },
    ],
    instrument: instrument.toUpperCase(),
    side,
  }

  if (p.includes("intraday") || p.includes("intra day")) {
    exitRules.push({ exit_at_end_of_day: true })
  }
  if (exitRules.length === 0) {
    exitRules.push({})
  }

  return {
    name: `NL Strategy - ${instrument.toUpperCase()}`,
    description: prompt,
    timeframe,
    entry_rules: [entryRule],
    exit_rules: exitRules,
    risk_management: riskMgmt,
  }
}

function extractInstrument(prompt: string): string {
  for (const inst of INSTRUMENTS_KNOWN) {
    if (prompt.includes(inst)) return inst
  }
  const match = prompt.match(/(?:buy|sell|entry)\s+(\w+)/)
  return match ? match[1] : "NIFTY"
}

function extractSide(prompt: string): Side {
  return /\b(short|sell)\b/.test(prompt) ? "sell" : "buy"
}

function extractTimeframe(prompt: string): Timeframe {
  if (/\b(1\s*min|1m)\b/.test(prompt)) return "1m"
  if (/\b(5\s*min|5m)\b/.test(prompt)) return "5m"
  if (/\b(15\s*min|15m)\b/.test(prompt)) return "15m"
  if (/\b(30\s*min|30m)\b/.test(prompt)) return "30m"
  if (/\b(1\s*h|hourly|1h)\b/.test(prompt)) return "1h"
  if (/\b(weekly|1w)\b/.test(prompt)) return "1w"
  return "1d"
}

function mapOperator(op: string): ConditionOperator {
  const o = op.trim()
  if (o === ">>" || o === ">") return ">"
  if (o === "<<" || o === "<") return "<"
  if (o === ">=") return ">="
  if (o === "<=") return "<="
  if (o === "==") return "=="
  if (o === "!=") return "!="
  return ">"
}

function extractConditions(prompt: string): Condition[] {
  const conditions: Condition[] = []

  const rsiMatch = prompt.match(/rsi\s*\(\s*(\d+)\s*\)\s*([<>=!]+)\s*(\d+)/i)
  if (rsiMatch) {
    conditions.push({
      indicator: "rsi",
      operator: mapOperator(rsiMatch[2]),
      value: parseFloat(rsiMatch[3]),
      period: parseInt(rsiMatch[1]),
    })
  }

  const emaCross = prompt.match(/(?:crosses?\s+(?:above|over))\s+(?:the\s+)?(?:\d+\s*)?ema\s*\(\s*(\d+)\s*\)/i)
  if (emaCross) {
    conditions.push({
      indicator: "ema",
      operator: "cross_above",
      value: 0,
      period: parseInt(emaCross[1]),
    })
  }

  const emaCrossBelow = prompt.match(/(?:crosses?\s+(?:below|under))\s+(?:the\s+)?(?:\d+\s*)?ema\s*\(\s*(\d+)\s*\)/i)
  if (emaCrossBelow) {
    conditions.push({
      indicator: "ema",
      operator: "cross_below",
      value: 0,
      period: parseInt(emaCrossBelow[1]),
    })
  }

  const smaMatch = prompt.match(/sma\s*\(\s*(\d+)\s*\)\s*([<>=]+)\s*(\d+)/i)
  if (smaMatch) {
    conditions.push({
      indicator: "sma",
      operator: mapOperator(smaMatch[2]),
      value: parseFloat(smaMatch[3]),
      period: parseInt(smaMatch[1]),
    })
  }

  const macdMatch = prompt.match(/macd\s+(?:crosses?\s+above|>\s*signal)/i)
  if (macdMatch) {
    conditions.push({
      indicator: "macd",
      operator: "cross_above",
      value: 0,
    })
  }

  const adxMatch = prompt.match(/adx\s*\(\s*(\d+)\s*\)\s*([<>=]+)\s*(\d+)/i)
  if (adxMatch) {
    conditions.push({
      indicator: "adx",
      operator: mapOperator(adxMatch[2]),
      value: parseFloat(adxMatch[3]),
      period: parseInt(adxMatch[1]),
    })
  }

  if (conditions.length === 0) {
    conditions.push({
      indicator: "sma",
      operator: "cross_above",
      value: 20,
      period: 20,
    })
  }

  return conditions
}

function extractRiskManagement(prompt: string): RiskManagement {
  const rm: RiskManagement = {}

  const slMatch = prompt.match(/stop\s*loss\s*(\d+\.?\d*)\s*%/i)
  if (slMatch) rm.stop_loss_percent = parseFloat(slMatch[1])

  const tpMatch = prompt.match(/target\s*(\d+\.?\d*)\s*%/i)
  if (tpMatch) rm.take_profit_percent = parseFloat(tpMatch[1])

  const trailMatch = prompt.match(/trailing\s*(?:stop)?\s*(\d+\.?\d*)\s*%/i)
  if (trailMatch) rm.trailing_stop_percent = parseFloat(trailMatch[1])

  const maxLossMatch = prompt.match(/max\s*(?:loss|drawdown)\s*(?:per\s*day\s*)?(\d+)/i)
  if (maxLossMatch) rm.max_loss_per_day = parseFloat(maxLossMatch[1])

  const maxPosMatch = prompt.match(/max\s*positions?\s*(\d+)/i)
  rm.max_positions = maxPosMatch ? parseInt(maxPosMatch[1]) : 1

  return rm
}

function extractExitRules(prompt: string): ExitRule[] {
  const rules: ExitRule[] = []
  if (prompt.includes("intraday") || prompt.includes("intra day") || prompt.includes("eod")) {
    rules.push({ exit_at_end_of_day: true })
  }
  if (prompt.includes("swing")) {
    rules.push({ max_bars_in_trade: 20 })
  }
  return rules
}

export function strategyToJSON(strategy: StrategyDefinition): string {
  return JSON.stringify(strategy, null, 2)
}

export function strategyToYAML(strategy: StrategyDefinition): string {
  let yaml = ""
  for (const [key, val] of Object.entries(strategy)) {
    if (val === undefined || val === null) continue
    if (typeof val === "object" && !Array.isArray(val)) {
      yaml += `${key}:\n`
      for (const [k2, v2] of Object.entries(val)) {
        yaml += `  ${k2}: ${v2}\n`
      }
    } else if (Array.isArray(val)) {
      yaml += `${key}:\n`
      for (const item of val) {
        if (typeof item === "object") {
          for (const [k2, v2] of Object.entries(item)) {
            yaml += `  - ${k2}: ${v2}\n`
          }
        } else {
          yaml += `  - ${item}\n`
        }
      }
    } else {
      yaml += `${key}: ${val}\n`
    }
  }
  return yaml
}
