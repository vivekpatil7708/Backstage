import type {
  StrategyDefinition,
  Condition,
  ConditionOperator,
  OHLCVBar,
  BacktestResult,
  TradeOrder,
  OpenPosition,
  ClosedTrade,
  EquityPoint,
} from "./types"
import { computeIndicator, getIndicatorValue, type IndicatorResult } from "./indicators"

function cryptoId(): string {
  const arr = new Uint8Array(16)
  for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256)
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("")
}

function defaultStrategy(s: StrategyDefinition): Required<Pick<StrategyDefinition, "timeframe" | "initial_capital" | "exit_rules" | "risk_management" | "position_sizing" | "transaction_costs">> & StrategyDefinition {
  return {
    ...s,
    timeframe: s.timeframe || "1d",
    initial_capital: s.initial_capital || 100000,
    exit_rules: s.exit_rules && s.exit_rules.length > 0 ? s.exit_rules : [{}],
    risk_management: s.risk_management || {},
    position_sizing: s.position_sizing || {},
    transaction_costs: s.transaction_costs || {},
  }
}

function evaluateCondition(cond: Condition, indicatorCache: Record<string, IndicatorResult>, bars: OHLCVBar[], idx: number): boolean {
  const period = cond.period || 14
  const cacheKey = `${cond.indicator}_${period}`
  if (!indicatorCache[cacheKey]) {
    indicatorCache[cacheKey] = computeIndicator(cond.indicator, bars, { period })
  }
  const actual = getIndicatorValue(indicatorCache[cacheKey], cond.indicator, idx)
  const target = typeof cond.value === "number" ? cond.value : parseFloat(String(cond.value)) || 0

  switch (cond.operator) {
    case ">": return actual > target
    case "<": return actual < target
    case ">=": return actual >= target
    case "<=": return actual <= target
    case "==": return Math.abs(actual - target) < 1e-8
    case "!=": return Math.abs(actual - target) >= 1e-8
    case "cross_above": {
      if (idx < 1) return false
      const prev = getIndicatorValue(indicatorCache[cacheKey], cond.indicator, idx - 1)
      return prev <= target && actual > target
    }
    case "cross_below": {
      if (idx < 1) return false
      const prev = getIndicatorValue(indicatorCache[cacheKey], cond.indicator, idx - 1)
      return prev >= target && actual < target
    }
    default: return false
  }
}

function evaluateConditions(conditions: Condition[], indicatorCache: Record<string, IndicatorResult>, bars: OHLCVBar[], idx: number): boolean {
  return conditions.every(c => evaluateCondition(c, indicatorCache, bars, idx))
}

function calculateCharges(price: number, quantity: number, side: string, tc: StrategyDefinition["transaction_costs"] = {}) {
  const turnover = price * quantity
  const brokerage = tc?.brokerage_per_order ?? 20
  const sttPct = tc?.stt_percent ?? 0.05
  const exchangeCharges = tc?.exchange_charges ?? 0.003
  const sebiCharges = tc?.sebi_charges ?? 0.001
  const gstPct = tc?.gst_percent ?? 18
  const slippageTicks = tc?.slippage_ticks ?? 1
  const slippageValue = tc?.slippage_value ?? 0

  const stt = turnover * (sttPct / 100)
  const exchange = turnover * (exchangeCharges / 100)
  const sebi = turnover * (sebiCharges / 100)
  const gst = (brokerage + exchange) * (gstPct / 100)
  const slippage = slippageTicks * slippageValue * quantity

  return { brokerage, stt, other_charges: exchange + sebi + gst, slippage }
}

function fillOrder(
  timestamp: string, instrument: string, side: string,
  quantity: number, price: number, tag: string,
  capital: number, tc: StrategyDefinition["transaction_costs"] = {}
): { order: TradeOrder; capital: number } {
  const slippageTicks = tc?.slippage_ticks ?? 1
  const slippageValue = tc?.slippage_value ?? 0
  const slippage = slippageTicks * slippageValue
  const fillPrice = side === "buy" ? price + slippage : price - slippage
  const charges = calculateCharges(fillPrice, quantity, side, tc)
  const totalCost = charges.brokerage + charges.stt + charges.other_charges

  if (side === "buy") capital -= fillPrice * quantity + totalCost
  else capital += fillPrice * quantity - totalCost

  return {
    order: {
      id: cryptoId(),
      timestamp,
      instrument,
      side,
      quantity,
      price: fillPrice,
      slippage: charges.slippage,
      brokerage: charges.brokerage,
      stt: charges.stt,
      other_charges: charges.other_charges,
      tag,
    },
    capital,
  }
}

function computePositionPnl(pos: OpenPosition, currentPrice: number): number {
  const entryPrice = pos.entry_order.price
  const qty = pos.entry_order.quantity
  return pos.entry_order.side === "buy"
    ? (currentPrice - entryPrice) * qty
    : (entryPrice - currentPrice) * qty
}

export function runBacktest(strategy: StrategyDefinition, bars: OHLCVBar[]): BacktestResult {
  const s = defaultStrategy(strategy)
  const rm = s.risk_management
  const maxPositions = rm.max_positions ?? 1
  const tc = s.transaction_costs
  const ps = s.position_sizing
  const initialCapital = s.initial_capital

  let capital = initialCapital
  let peakEquity = initialCapital
  const positions: OpenPosition[] = []
  const closedTrades: ClosedTrade[] = []
  const equityCurve: EquityPoint[] = []
  let totalBrokerage = 0
  let totalStt = 0
  const indicatorCache: Record<string, IndicatorResult> = {}

  for (let idx = 0; idx < bars.length; idx++) {
    const ts = bars[idx].datetime
    const currentPrice = bars[idx].Close

    const closedIndices: number[] = []
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      if (currentPrice > pos.highest_price) pos.highest_price = currentPrice
      pos.bars_held += 1
      pos.current_price = currentPrice
      pos.unrealized_pnl = computePositionPnl(pos, currentPrice)

      let exitReason: string | null = null

      if (rm.stop_loss_percent && pos.entry_order.side === "buy") {
        const slPrice = pos.entry_order.price * (1 - rm.stop_loss_percent / 100)
        if (currentPrice <= slPrice) exitReason = "stop_loss"
      } else if (rm.stop_loss_percent && pos.entry_order.side === "sell") {
        const slPrice = pos.entry_order.price * (1 + rm.stop_loss_percent / 100)
        if (currentPrice >= slPrice) exitReason = "stop_loss"
      }

      if (!exitReason && rm.take_profit_percent && pos.entry_order.side === "buy") {
        const tpPrice = pos.entry_order.price * (1 + rm.take_profit_percent / 100)
        if (currentPrice >= tpPrice) exitReason = "take_profit"
      } else if (!exitReason && rm.take_profit_percent && pos.entry_order.side === "sell") {
        const tpPrice = pos.entry_order.price * (1 - rm.take_profit_percent / 100)
        if (currentPrice <= tpPrice) exitReason = "take_profit"
      }

      if (!exitReason && rm.trailing_stop_percent) {
        if (pos.entry_order.side === "buy") {
          const trailPrice = pos.highest_price * (1 - rm.trailing_stop_percent / 100)
          if (currentPrice <= trailPrice) exitReason = "trailing_stop"
        } else {
          const trailPrice = pos.highest_price * (1 + rm.trailing_stop_percent / 100)
          if (currentPrice >= trailPrice) exitReason = "trailing_stop"
        }
      }

      if (!exitReason) {
        for (const rule of s.exit_rules) {
          if (rule.max_bars_in_trade && pos.bars_held >= rule.max_bars_in_trade) { exitReason = "max_bars"; break }
          if (rule.exit_at_end_of_day) {
            const hour = parseInt(ts.split("T")[1]?.split(":")[0] || "0", 10)
            const minute = parseInt(ts.split("T")[1]?.split(":")[1] || "0", 10)
            if (hour >= 15 && minute >= 15) { exitReason = "eod"; break }
          }
          if (rule.conditions && rule.conditions.length > 0 && evaluateConditions(rule.conditions, indicatorCache, bars, idx)) {
            exitReason = "signal"; break
          }
        }
      }

      if (exitReason) {
        const exitSide = pos.entry_order.side === "buy" ? "sell" : "buy"
        const { order: exitOrder, capital: newCap } = fillOrder(ts, pos.entry_order.instrument, exitSide, pos.entry_order.quantity, currentPrice, exitReason, capital, tc)
        capital = newCap
        const netPnl = pos.unrealized_pnl - exitOrder.brokerage - exitOrder.stt - exitOrder.other_charges
        closedTrades.push({
          entry_order: pos.entry_order,
          exit_order: exitOrder,
          pnl: pos.unrealized_pnl,
          net_pnl: netPnl,
          holding_bars: pos.bars_held,
          exit_reason: exitReason,
        })
        capital += pos.unrealized_pnl
        totalBrokerage += exitOrder.brokerage
        totalStt += exitOrder.stt
        closedIndices.push(i)
      }
    }

    for (let i = closedIndices.length - 1; i >= 0; i--) {
      positions.splice(closedIndices[i], 1)
    }

    let dailyLoss = 0
    for (const trade of closedTrades) {
      const tradeDate = trade.exit_order.timestamp.split("T")[0]
      const currentDate = ts.split("T")[0]
      if (tradeDate === currentDate && trade.net_pnl < 0) {
        dailyLoss += Math.abs(trade.net_pnl)
      }
    }
    if (rm.max_loss_per_day && dailyLoss >= rm.max_loss_per_day) {
      equityCurve.push({ timestamp: ts, equity: capital, drawdown: 0 })
      continue
    }

    if (positions.length < maxPositions) {
      for (const rule of s.entry_rules) {
        if (evaluateConditions(rule.conditions, indicatorCache, bars, idx)) {
          const qty = getQuantity(ps, bars, capital)
          const { order, capital: newCap } = fillOrder(ts, rule.instrument, rule.side, qty, currentPrice, "entry", capital, tc)
          capital = newCap
          positions.push({
            entry_order: order,
            current_price: currentPrice,
            highest_price: currentPrice,
            unrealized_pnl: 0,
            bars_held: 0,
          })
          totalBrokerage += order.brokerage
          totalStt += order.stt
          break
        }
      }
    }

    if (capital > peakEquity) peakEquity = capital
    const dd = peakEquity > 0 ? ((peakEquity - capital) / peakEquity) * 100 : 0
    equityCurve.push({ timestamp: ts, equity: capital, drawdown: dd })
  }

  for (const pos of [...positions]) {
    const lastPrice = bars[bars.length - 1].Close
    const exitSide = pos.entry_order.side === "buy" ? "sell" : "buy"
    const { order: exitOrder, capital: newCap } = fillOrder(
      bars[bars.length - 1].datetime, pos.entry_order.instrument, exitSide,
      pos.entry_order.quantity, lastPrice, "end_of_backtest", capital, tc
    )
    capital = newCap
    const pnl = computePositionPnl(pos, lastPrice)
    closedTrades.push({
      entry_order: pos.entry_order,
      exit_order: exitOrder,
      pnl,
      net_pnl: pnl - exitOrder.brokerage - exitOrder.stt,
      holding_bars: pos.bars_held,
      exit_reason: "end_of_backtest",
    })
  }
  positions.length = 0

  return computeResults(s, bars, closedTrades, equityCurve, capital, peakEquity, totalBrokerage, totalStt, initialCapital)
}

function getQuantity(ps: StrategyDefinition["position_sizing"] = {}, bars: OHLCVBar[], equity: number): number {
  const sizingType = ps?.sizing_type || "fixed_lot"
  const close = bars[0].Close
  switch (sizingType) {
    case "fixed_lot": return ps?.lot_size || 1
    case "fixed_capital": return Math.max(1, Math.floor((ps?.capital_per_trade || 100000) / close))
    case "percent_capital": {
      const alloc = equity * (ps?.percent_capital || 10) / 100
      return Math.max(1, Math.floor(alloc / close))
    }
    default: return 1
  }
}

function computeResults(
  s: Required<Pick<StrategyDefinition, "initial_capital">> & StrategyDefinition,
  bars: OHLCVBar[],
  trades: ClosedTrade[],
  equityCurve: EquityPoint[],
  finalCapital: number,
  peakEquity: number,
  totalBrokerage: number,
  totalStt: number,
  initialCapital: number,
): BacktestResult {
  const n = trades.length
  const wins = trades.filter(t => t.net_pnl > 0)
  const losses = trades.filter(t => t.net_pnl <= 0)

  const totalDays = (new Date(bars[bars.length - 1].datetime).getTime() - new Date(bars[0].datetime).getTime()) / (1000 * 60 * 60 * 24)
  const years = Math.max(totalDays / 365.25, 0.01)
  const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100
  const cagr = (Math.pow(finalCapital / initialCapital, 1 / years) - 1) * 100

  const eqSeries = equityCurve.map(e => e.equity)
  const ddSeries = equityCurve.map(e => e.drawdown)
  const maxDD = ddSeries.length > 0 ? Math.max(...ddSeries) : 0

  const dailyReturns: number[] = []
  for (let i = 1; i < eqSeries.length; i++) {
    if (eqSeries[i - 1] > 0) dailyReturns.push((eqSeries[i] - eqSeries[i - 1]) / eqSeries[i - 1])
  }

  const avgRet = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0
  const variance = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + (b - avgRet) ** 2, 0) / dailyReturns.length : 0
  const stdDev = Math.sqrt(variance)
  const volatility = stdDev * Math.sqrt(252) * 100

  const downside = dailyReturns.filter(r => r < 0)
  const downVariance = downside.length > 0 ? downside.reduce((a, b) => a + b ** 2, 0) / downside.length : 1e-20
  const downsideVol = Math.sqrt(downVariance) * Math.sqrt(252)
  const sharpe = (avgRet * 252) / (stdDev * Math.sqrt(252) || 1e-10)
  const sortino = (avgRet * 252) / (downsideVol || 1e-10)

  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.net_pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((a, t) => a + t.net_pnl, 0) / losses.length : 0
  const grossProfit = wins.reduce((a, t) => a + t.net_pnl, 0)
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.net_pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
  const winRate = n > 0 ? (wins.length / n) * 100 : 0
  const avgBars = n > 0 ? trades.reduce((a, t) => a + t.holding_bars, 0) / n : 0

  const tradingDays = eqSeries.length
  const daysInPosition = trades.reduce((a, t) => a + t.holding_bars, 0)
  const exposure = tradingDays > 0 ? (daysInPosition / tradingDays) * 100 : 0

  const monthly: Record<string, { equity: number }> = {}
  for (const e of equityCurve) {
    const key = e.timestamp.substring(0, 7)
    monthly[key] = { equity: e.equity }
  }
  const monthlyReturns: { month: string; return: number; equity: number }[] = []
  let prevEq = initialCapital
  for (const [month, { equity }] of Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]))) {
    const ret = prevEq > 0 ? ((equity - prevEq) / prevEq) * 100 : 0
    monthlyReturns.push({ month, return: Math.round(ret * 100) / 100, equity: Math.round(equity * 100) / 100 })
    prevEq = equity
  }

  return {
    strategy_name: s.name,
    start_date: bars[0].datetime.split("T")[0],
    end_date: bars[bars.length - 1].datetime.split("T")[0],
    initial_capital: initialCapital,
    final_capital: Math.round(finalCapital * 100) / 100,
    total_return_pct: Math.round(totalReturn * 100) / 100,
    cagr: Math.round(cagr * 100) / 100,
    max_drawdown_pct: Math.round(maxDD * 100) / 100,
    max_drawdown_amount: Math.round(peakEquity * maxDD / 100 * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    sharpe_ratio: Math.round(sharpe * 100) / 100,
    sortino_ratio: Math.round(sortino * 100) / 100,
    win_rate: Math.round(winRate * 100) / 100,
    average_win: Math.round(avgWin * 100) / 100,
    average_loss: Math.round(avgLoss * 100) / 100,
    profit_factor: Math.round(profitFactor * 100) / 100,
    total_trades: n,
    winning_trades: wins.length,
    losing_trades: losses.length,
    avg_holding_bars: Math.round(avgBars * 10) / 10,
    exposure_pct: Math.round(exposure * 100) / 100,
    total_brokerage: Math.round(totalBrokerage * 100) / 100,
    total_stt: Math.round(totalStt * 100) / 100,
    equity_curve: equityCurve,
    trades,
    monthly_returns: monthlyReturns,
  }
}
