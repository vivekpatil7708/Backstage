import { parseNaturalLanguage } from "./parser"

interface ChatContext {
  strategy?: any
  result?: any
}

const SYSTEM_PROMPT = `You are an expert Indian stock market trading strategy coach specializing in NSE equity, F&O, and indices.

Core expertise:
- Technical analysis (RSI, MACD, EMA, SMA, Bollinger Bands, ATR, Supertrend, ADX, VWAP, Stochastic)
- Indian market structure (NSE trading hours 9:15-15:30, lot sizes, tick sizes, circuit limits)
- F&O specifics (weekly/monthly expiry, STT rates, marginSPAN, Greeks, India VIX)
- Transaction costs (brokerage ₹20/order flat, STT 0.05% sell-side, exchange charges, SEBI fees, GST 18%)
- Risk management (Kelly criterion, max drawdown limits, position sizing, correlation risk)
- Backtest analysis (overfitting detection, walk-forward validation, Monte Carlo simulation concepts)

Communication style:
- Be direct and specific. Reference actual numbers when analyzing results.
- Use bullet points for clarity. Lead with the most important insight.
- Always quantify your advice (e.g., "increase stop loss to 2.5%" not "consider a wider stop")
- Mention Indian-specific pitfalls (gap openings, circuit breakers, settlement cycles)

When analyzing backtest results, always evaluate:
1. Risk-adjusted returns (Sharpe > 1 is good, > 2 is excellent)
2. Max drawdown vs return (Calmar ratio)
3. Win rate vs avg win/loss ratio
4. Profit factor (> 1.5 is good)
5. Trade count (statistical significance)
6. Monthly return consistency
7. Exposure time vs idle capital
8. Transaction cost impact on net returns`

function buildContextBlock(context: ChatContext): string {
  const parts: string[] = []

  if (context.strategy) {
    const s = context.strategy
    const entry = s.entry_rules?.[0]
    if (entry) {
      const conds = entry.conditions?.map(
        (c: any) => `${c.indicator}(${c.period || ""}) ${c.operator} ${c.value}`
      ).join(" AND ") || "none"
      parts.push(
        `CURRENT STRATEGY:\n` +
        `- Name: ${s.name}\n` +
        `- Instrument: ${entry.instrument} (${entry.instrument_type || "equity"})\n` +
        `- Side: ${entry.side}\n` +
        `- Timeframe: ${s.timeframe || "1d"}\n` +
        `- Entry: ${conds}\n` +
        `- Stop Loss: ${s.risk_management?.stop_loss_percent || "none"}%\n` +
        `- Take Profit: ${s.risk_management?.take_profit_percent || "none"}%\n` +
        `- Trailing Stop: ${s.risk_management?.trailing_stop_percent || "none"}%\n` +
        `- Capital: ₹${s.initial_capital?.toLocaleString() || "100,000"}\n` +
        `- Slippage: ${s.transaction_costs?.slippage_value || 0} × ${s.transaction_costs?.slippage_ticks || 1} tick(s)`
      )
    }
  }

  if (context.result) {
    const r = context.result
    parts.push(
      `BACKTEST RESULTS:\n` +
      `- Period: ${r.start_date} to ${r.end_date}\n` +
      `- Return: ${r.total_return_pct}% (CAGR: ${r.cagr}%)\n` +
      `- Final Capital: ₹${r.final_capital?.toLocaleString()}\n` +
      `- Max Drawdown: ${r.max_drawdown_pct}% (₹${r.max_drawdown_amount?.toLocaleString()})\n` +
      `- Sharpe: ${r.sharpe_ratio} | Sortino: ${r.sortino_ratio}\n` +
      `- Volatility: ${r.volatility}%\n` +
      `- Win Rate: ${r.win_rate}% (${r.winning_trades}W / ${r.losing_trades}L)\n` +
      `- Avg Win: ₹${r.average_win?.toLocaleString()} | Avg Loss: ₹${r.average_loss?.toLocaleString()}\n` +
      `- Profit Factor: ${r.profit_factor}\n` +
      `- Total Trades: ${r.total_trades}\n` +
      `- Exposure: ${r.exposure_pct}%\n` +
      `- Brokerage: ₹${r.total_brokerage?.toLocaleString()} | STT: ₹${r.total_stt?.toLocaleString()}`
    )
  }

  return parts.length > 0 ? parts.join("\n\n") : ""
}

function analyzeResults(r: any): string {
  if (!r) return "No backtest results to analyze. Run a backtest first and I'll give you detailed feedback."

  const issues: string[] = []
  const strengths: string[] = []
  const actions: string[] = []

  if (r.total_trades < 30) issues.push(`Only ${r.total_trades} trades - statistically unreliable. Need 50+ trades for confidence.`)
  else if (r.total_trades < 100) issues.push(`${r.total_trades} trades - decent sample but more would increase confidence.`)
  else strengths.push(`${r.total_trades} trades - good statistical sample.`)

  if (r.max_drawdown_pct > 20) issues.push(`Max drawdown ${r.max_drawdown_pct}% is too high for most traders. Cap at 15%.`)
  else if (r.max_drawdown_pct > 10) issues.push(`Max drawdown ${r.max_drawdown_pct}% is acceptable but could be tighter.`)
  else strengths.push(`Max drawdown ${r.max_drawdown_pct}% is well controlled.`)

  if (r.sharpe_ratio < 0.5) issues.push(`Sharpe ${r.sharpe_ratio} is poor. Aim for > 1.0.`)
  else if (r.sharpe_ratio < 1) issues.push(`Sharpe ${r.sharpe_ratio} is below average. Target > 1.0.`)
  else if (r.sharpe_ratio < 2) strengths.push(`Sharpe ${r.sharpe_ratio} is good.`)
  else strengths.push(`Sharpe ${r.sharpe_ratio} is excellent.`)

  if (r.win_rate > 0 && r.average_win > 0 && r.average_loss < 0) {
    const rr = Math.abs(r.average_win / r.average_loss)
    if (rr < 1 && r.win_rate < 60) issues.push(`Risk:Reward ${rr.toFixed(1)}:1 with ${r.win_rate}% win rate is unprofitable long-term.`)
    else if (rr > 2 && r.win_rate > 40) strengths.push(`Strong Risk:Reward ${rr.toFixed(1)}:1 with ${r.win_rate}% win rate.`)
  }

  if (r.profit_factor < 1) issues.push(`Profit factor ${r.profit_factor} < 1 means losing money. Strategy needs rethinking.`)
  else if (r.profit_factor < 1.2) issues.push(`Profit factor ${r.profit_factor} is borderline. Too fragile for live trading.`)
  else if (r.profit_factor > 2) strengths.push(`Profit factor ${r.profit_factor} is excellent.`)

  if (r.total_brokerage + r.total_stt > 0 && r.final_capital > 0) {
    const costPct = ((r.total_brokerage + r.total_stt) / r.initial_capital * 100)
    if (costPct > 5) issues.push(`Transaction costs consumed ${costPct.toFixed(1)}% of capital. Reduce trade frequency or increase holding period.`)
  }

  if (r.volatility > 25) issues.push(`Portfolio volatility ${r.volatility}% is very high. Consider wider timeframes or fewer positions.`)

  if (r.exposure_pct < 20) actions.push("Low exposure - consider loosening entry conditions or increasing max positions.")
  if (r.exposure_pct > 80) issues.push("Very high exposure - limited capital for new opportunities, higher risk concentration.")

  let output = ""
  if (strengths.length > 0) output += "STRENGTHS:\n" + strengths.map(s => `  + ${s}`).join("\n") + "\n\n"
  if (issues.length > 0) output += "ISSUES:\n" + issues.map(i => `  ! ${i}`).join("\n") + "\n\n"

  if (actions.length > 0) output += "NEXT STEPS:\n" + actions.map(a => `  > ${a}`).join("\n") + "\n\n"

  output += "RECOMMENDATIONS:\n"
  output += "  1. Test on out-of-sample data (different time period)\n"
  output += "  2. Run Monte Carlo on trade sequence for confidence intervals\n"
  output += "  3. Try walk-forward optimization (6mo train / 3mo test)\n"
  output += "  4. Paper trade for 2-4 weeks before going live\n"

  return output
}

function designStrategy(message: string): string {
  const strategy = parseNaturalLanguage(message)
  const entry = strategy.entry_rules[0]
  const conds = entry.conditions.map(
    (c: any) => `  - ${c.indicator}(${c.period || ""}) ${c.operator} ${c.value}`
  ).join("\n")

  let advice = ""
  if (!strategy.risk_management?.stop_loss_percent) {
    advice += "\n\nWARNING: No stop loss detected. Always use a stop loss. For " +
      (entry.instrument.includes("NIFTY") ? "indices, 1-2% is standard." : "stocks, 2-3% is typical.")
  }
  if (!strategy.risk_management?.take_profit_percent) {
    advice += "\nTIP: Consider adding a take profit target. A 1:2 risk-reward ratio is a good starting point."
  }

  return (
    `PARSED STRATEGY:\n\n` +
    `Name: ${strategy.name}\n` +
    `Instrument: ${entry.instrument} (${entry.instrument_type || "equity"})\n` +
    `Side: ${entry.side}\n` +
    `Timeframe: ${strategy.timeframe || "1d"}\n\n` +
    `ENTRY CONDITIONS:\n${conds}\n\n` +
    `RISK MANAGEMENT:\n` +
    `  - Stop Loss: ${strategy.risk_management?.stop_loss_percent || "Not set"}%\n` +
    `  - Take Profit: ${strategy.risk_management?.take_profit_percent || "Not set"}%\n` +
    `  - Trailing Stop: ${strategy.risk_management?.trailing_stop_percent || "Not set"}%\n` +
    `  - Max Positions: ${strategy.risk_management?.max_positions || 1}\n` +
    advice +
    `\n\nThis strategy is ready to backtest. Click "Run Backtest" to see performance.`
  )
}

function explainIndicator(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("rsi")) {
    return (
      "RSI (Relative Strength Index):\n\n" +
      "WHAT: Measures momentum on 0-100 scale. Below 30 = oversold, above 70 = overbought.\n\n" +
      "INDIAN MARKET NOTES:\n" +
      "- NIFTY rarely stays below 30 for more than 3-4 days\n" +
      "- Use RSI(14) on daily, RSI(9) on intraday\n" +
      "- RSI divergence with price is a strong reversal signal\n" +
      "- Works best in range-bound markets, fails in trending\n\n" +
      "COMMON STRATEGIES:\n" +
      "  1. Buy when RSI(14) < 30, sell when > 70\n" +
      "  2. Buy on RSI cross above 30 (mean reversion)\n" +
      "  3. Short when RSI > 80 in overbought market\n" +
      "  4. RSI + EMA combo: RSI < 30 AND price > 20 EMA for high-prob entries"
    )
  }
  if (m.includes("macd")) {
    return (
      "MACD (Moving Average Convergence Divergence):\n\n" +
      "WHAT: Trend-following momentum indicator. MACD line = EMA(12) - EMA(26).\n" +
      "Signal line = EMA(9) of MACD. Histogram = MACD - Signal.\n\n" +
      "INDIAN MARKET NOTES:\n" +
      "- Works well on NIFTY/BANKNIFTY daily charts\n" +
      "- MACD crossover + volume confirmation = high conviction\n" +
      "- Histogram divergence signals trend exhaustion\n\n" +
      "COMMON STRATEGIES:\n" +
      "  1. Buy when MACD crosses above signal line\n" +
      "  2. Sell when MACD crosses below signal line\n" +
      "  3. Buy when histogram turns positive from negative\n" +
      "  4. MACD + RSI: MACD cross UP + RSI < 50 = strong buy"
    )
  }
  if (m.includes("ema") || m.includes("sma")) {
    return (
      "Moving Averages (EMA/SMA):\n\n" +
      "WHAT: EMA = Exponential (recent prices weighted more). SMA = Simple (equal weight).\n\n" +
      "KEY PERIODS:\n" +
      "- 9 EMA: Scalping, very fast\n" +
      "- 20 EMA: Short-term trend\n" +
      "- 50 SMA: Medium-term trend\n" +
      "- 200 SMA: Long-term trend (institutional reference)\n\n" +
      "INDIAN MARKET NOTES:\n" +
      "- 200 DMA is a critical support/resistance for NIFTY\n" +
      "- Death cross (50 below 200) preceded 2020 and 2022 corrections\n" +
      "- 20 EMA pullback strategy works well in trending markets\n\n" +
      "COMMON STRATEGIES:\n" +
      "  1. Buy when price crosses above 20 EMA, sell when below\n" +
      "  2. Golden cross (50 above 200) = long-term buy signal\n" +
      "  3. EMA ribbon (9, 21, 55): all aligned up = strong trend"
    )
  }
  if (m.includes("bollinger")) {
    return (
      "Bollinger Bands:\n\n" +
      "WHAT: SMA(20) +/- 2 standard deviations. Price touches upper = overbought, lower = oversold.\n\n" +
      "STRATEGIES:\n" +
      "  1. Mean reversion: Buy at lower band, sell at upper band\n" +
      "  2. Squeeze: Narrow bands predict big move coming\n" +
      "  3. Walk the band: Price riding upper band = strong uptrend\n\n" +
      "Works best in range-bound markets. Avoid using alone in trending markets."
    )
  }
  if (m.includes("supertrend")) {
    return (
      "Supertrend:\n\n" +
      "WHAT: ATR-based trend indicator. Green = uptrend, Red = downtrend.\n" +
      "Parameters: Period (default 10), Multiplier (default 3).\n\n" +
      "INDIAN MARKET NOTES:\n" +
      "- Very popular for NIFTY/BANKNIFTY intraday in India\n" +
      "- Works well on 15min and 1h timeframes\n" +
      "- Prone to whipsaws in sideways markets\n\n" +
      "STRATEGY:\n" +
      "  - Buy when Supertrend turns green (bullish)\n" +
      "  - Sell when Supertrend turns red (bearish)\n" +
      "  - Combine with RSI filter: only buy when RSI > 40"
    )
  }
  if (m.includes("adx")) {
    return (
      "ADX (Average Directional Index):\n\n" +
      "WHAT: Measures trend strength (0-100). Above 25 = trending. Below 20 = ranging.\n\n" +
      "INDIAN MARKET NOTES:\n" +
      "- NIFTY trends strongly during budget/earnings seasons\n" +
      "- ADX > 30 during trending periods for momentum strategies\n\n" +
      "STRATEGY:\n" +
      "  - Use ADX filter: only trade when ADX > 25\n" +
      "  - ADX rising = trend strengthening\n" +
      "  - Combine: ADX > 25 + Supertrend green = strong long"
    )
  }
  if (m.includes("atr")) {
    return (
      "ATR (Average True Range):\n\n" +
      "WHAT: Measures volatility (absolute, not percentage). Higher = more volatile.\n\n" +
      "USE CASES:\n" +
      "  1. Stop loss: Set SL at 1.5-2x ATR from entry\n" +
      "  2. Position sizing: Risk per trade / ATR = position size\n" +
      "  3. Breakout filter: Only trade when ATR expanding\n\n" +
      "For NIFTY: ATR(14) on daily typically ranges 100-400 points."
    )
  }
  return (
    "Available indicators: RSI, EMA, SMA, MACD, Bollinger Bands, ATR, Supertrend, ADX, VWAP, Stochastic.\n\n" +
    "Ask me about any specific indicator for detailed explanation and strategy suggestions."
  )
}

function riskManagementAdvice(): string {
  return (
    "RISK MANAGEMENT FOR INDIAN F&O/STOCKS:\n\n" +
    "POSITION SIZING:\n" +
    "- Risk max 1-2% of capital per trade\n" +
    "- For NIFTY options: 1 lot (50 qty) max per trade for ₹1L capital\n" +
    "- For BANKNIFTY options: 1 lot (15 qty) max per trade\n" +
    "- Kelly formula: f = (win_rate × avg_win - (1-win_rate) × avg_loss) / avg_win\n\n" +
    "STOP LOSSES:\n" +
    "- Equity: 2-3% stop loss\n" +
    "- NIFTY: 0.5-1% (tighter, more liquid)\n" +
    "- BANKNIFTY: 1-1.5%\n" +
    "- Options buying: 20-30% premium stop\n" +
    "- Always use stop loss. No exceptions.\n\n" +
    "RISK:REWARD:\n" +
    "- Minimum 1:2 risk:reward\n" +
    "- If win rate is 40%, need avg win ≥ 2.5× avg loss\n" +
    "- Track your expectancy: (win% × avg_win) - (loss% × avg_loss)\n\n" +
    "PORTFOLIO:\n" +
    "- Max 3-4 positions simultaneously\n" +
    "- Max 30% capital in F&O at any time\n" +
    "- No more than 2 correlated positions\n\n" +
    "DAILY LIMITS:\n" +
    "- Max daily loss: 2% of capital\n" +
    "- Stop trading after hitting daily limit\n" +
    "- Max 5 trades per day to avoid overtrading"
  )
}

function overfittingAdvice(): string {
  return (
    "AVOIDING OVERFITTING IN BACKTESTS:\n\n" +
    "SIGNS OF OVERFITTING:\n" +
    "- Return > 50% CAGR with > 70% win rate (too good to be true)\n" +
    "- Sharpe > 3 (unrealistic)\n" +
    "- Strategy has many conditions (> 3 entry rules)\n" +
    "- Works on one instrument but not others\n" +
    "- Performance drops sharply on out-of-sample data\n\n" +
    "TESTING METHODS:\n" +
    "1. Out-of-sample: Train on 2022, test on 2023\n" +
    "2. Walk-forward: 6mo train / 3mo test, rolling\n" +
    "3. Monte Carlo: Shuffle trade order 1000x, check worst case\n" +
    "4. Cross-validation: Test on different market regimes\n\n" +
    "RULES:\n" +
    "- Keep entry conditions to 2-3 max\n" +
    "- Prefer simple strategies (fewer parameters = less overfitting)\n" +
    "- If a strategy needs optimization, it's probably overfit\n" +
    "- Real edge comes from 1-2 well-tested signals, not 10 filters"
  )
}

function fallbackResponse(message: string, context: ChatContext): string {
  const m = message.toLowerCase()

  if (context.result && (m.includes("analyze") || m.includes("result") || m.includes("review") ||
      m.includes("evaluate") || m.includes("assess") || m.includes("feedback") || m.includes("improve"))) {
    return analyzeResults(context.result)
  }

  if (m.includes("overfit") || m.includes("curve fit") || m.includes("out of sample")) {
    return overfittingAdvice()
  }

  if (m.includes("risk") || m.includes("position size") || m.includes("stop loss") ||
      m.includes("sizing") || m.includes("capital")) {
    return riskManagementAdvice()
  }

  if (m.includes("indicator") || m.includes("rsi") || m.includes("macd") || m.includes("ema") ||
      m.includes("sma") || m.includes("bollinger") || m.includes("supertrend") || m.includes("adx") ||
      m.includes("atr") || m.includes("vwap") || m.includes("stochastic")) {
    return explainIndicator(message)
  }

  if (["strategy", "design", "create", "build", "make", "suggest", "idea"].some(w => m.includes(w))) {
    return designStrategy(message)
  }

  if (["option", "ce", "pe", "straddle", "strangle", "hedge", "spread"].some(w => m.includes(w))) {
    return (
      "INDIAN F&O TRADING GUIDE:\n\n" +
      "OPTION TYPES:\n" +
      "- CE (Call): Bullish. Price goes up, premium increases.\n" +
      "- PE (Put): Bearish. Price goes down, premium increases.\n\n" +
      "KEY CONCEPTS:\n" +
      "- Time decay (Theta): Options lose value daily, accelerate near expiry\n" +
      "- Implied Volatility (IV): Higher IV = more expensive premiums\n" +
      "- Greeks: Delta (direction), Gamma (acceleration), Theta (decay), Vega (IV)\n\n" +
      "INDIAN MARKET F&O:\n" +
      "- NIFTY lot size: 50 | BANKNIFTY: 15\n" +
      "- Weekly expiry: Thursday\n" +
      "- Monthly expiry: Last Thursday\n" +
      "- STT on sell: 0.05% | on exercise: 0.125%\n" +
      "- Margin required: 20-40% of contract value\n\n" +
      "COMMON STRATEGIES:\n" +
      "1. Buy CE when bullish: RSI < 30 + Supertrend green\n" +
      "2. Sell PE for income: When market is range-bound\n" +
      "3. Straddle: Buy both CE + PE before major events\n" +
      "4. Spread: Buy CE + Sell higher CE to reduce cost\n\n" +
      "Start with buying options (defined risk). Sell options only after experience."
    )
  }

  if (m.includes("backtest") || m.includes("test")) {
    if (context.result) {
      return analyzeResults(context.result)
    }
    return (
      "BACKTESTING GUIDE:\n\n" +
      "HOW TO BACKTEST:\n" +
      "1. Write your strategy in the Strategy Builder\n" +
      "2. Select data source (Yahoo Finance for real data)\n" +
      "3. Set date range (at least 1 year)\n" +
      "4. Configure stop loss, take profit, position sizing\n" +
      "5. Run backtest and analyze results\n\n" +
      "WHAT TO LOOK FOR:\n" +
      "- Sharpe ratio > 1.0\n" +
      "- Max drawdown < 20%\n" +
      "- Win rate × avg win > loss rate × avg loss\n" +
      "- 50+ trades for statistical significance\n" +
      "- Consistent monthly returns\n\n" +
      "Run a backtest and I'll analyze the results for you!"
    )
  }

  if (m.includes("slippage") || m.includes("cost") || m.includes("brokerage") || m.includes("stt")) {
    return (
      "INDIAN MARKET TRANSACTION COSTS:\n\n" +
      "BREAKDOWN PER TRADE:\n" +
      "- Brokerage: ₹20/order (flat, most discount brokers)\n" +
      "- STT (Securities Transaction Tax):\n" +
      "  - Intraday equity: 0.025% (sell side)\n" +
      "  - Delivery equity: 0.1% (both sides)\n" +
      "  - Futures: 0.0125% (sell side)\n" +
      "  - Options: 0.05% (sell side)\n" +
      "- Exchange charges: 0.003%\n" +
      "- SEBI charges: 0.001%\n" +
      "- GST: 18% on (brokerage + exchange charges)\n" +
      "- Stamp duty: 0.003% (buy side)\n\n" +
      "SLIPPAGE:\n" +
      "- 1 tick = ₹0.05 (for most stocks)\n" +
      "- NIFTY: 0.05 per point\n" +
      "- Expect 1-2 ticks slippage per trade\n\n" +
      "IMPACT:\n" +
      "- Each round-trip costs ~0.1-0.2% of turnover\n" +
      "- High-frequency strategies (< 5 bars avg hold) are killed by costs\n" +
      "- Use limit orders when possible to reduce slippage"
    )
  }

  return (
    "I'm your Strategy Coach! Here's what I can help with:\n\n" +
    "1. Design a strategy - Describe your trading idea in plain English\n" +
    "2. Analyze backtest results - Run a backtest, then ask me to review it\n" +
    "3. Learn indicators - Ask about RSI, MACD, EMA, Supertrend, etc.\n" +
    "4. Risk management - Position sizing, stop losses, daily limits\n" +
    "5. F&O trading - Options strategies, Greeks, expiry management\n" +
    "6. Avoid overfitting - Walk-forward, Monte Carlo, out-of-sample testing\n\n" +
    "Try: 'Buy NIFTY when RSI(14) < 30 and price crosses above 20 EMA. " +
    "Stop loss 1%, target 2%, intraday only'"
  )
}

export async function chatWithCoach(
  userMessage: string,
  history: { role: string; content: string }[] = [],
  context: ChatContext = {},
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (geminiKey) {
    try {
      return await chatGemini(userMessage, history, context, geminiKey)
    } catch { /* fall through */ }
  }

  if (openaiKey) {
    try {
      return await chatOpenAI(userMessage, history, context, openaiKey)
    } catch { /* fall through */ }
  }

  return fallbackResponse(userMessage, context)
}

async function chatGemini(
  userMessage: string,
  history: { role: string; content: string }[],
  context: ChatContext,
  apiKey: string,
): Promise<string> {
  const contextBlock = buildContextBlock(context)
  const systemText = SYSTEM_PROMPT + (contextBlock ? `\n\nCONTEXT:\n${contextBlock}` : "")

  const contents: { role: string; parts: { text: string }[] }[] = []
  for (const msg of history.slice(-10)) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    })
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2000,
        },
      }),
    },
  )

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || fallbackResponse(userMessage, context)
}

async function chatOpenAI(
  userMessage: string,
  history: { role: string; content: string }[],
  context: ChatContext,
  apiKey: string,
): Promise<string> {
  const contextBlock = buildContextBlock(context)
  const systemContent = SYSTEM_PROMPT + (contextBlock ? `\n\nCONTEXT:\n${contextBlock}` : "")

  const messages = [
    { role: "system", content: systemContent },
    ...history.slice(-10),
    { role: "user", content: userMessage },
  ]

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.5,
      max_tokens: 2000,
    }),
  })

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || fallbackResponse(userMessage, context)
}

export { SYSTEM_PROMPT }
