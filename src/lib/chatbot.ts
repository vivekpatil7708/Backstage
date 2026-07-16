import { parseNaturalLanguage } from "./parser"

const SYSTEM_PROMPT = `You are an expert Indian stock market trading strategy coach.
You help traders design, backtest, and improve their trading strategies for NSE stocks and F&O.

Key rules:
- Always emphasize risk management (stop losses, position sizing)
- Remind about transaction costs (brokerage, STT, exchange charges)
- Suggest realistic slippage assumptions
- For options, mention time decay and implied volatility
- Indian market specifics: F&O expiry days, circuit limits, margin requirements
- Never guarantee profits. Emphasize backtesting before live trading.

When helping design a strategy:
1. Clarify the trading idea
2. Suggest specific entry/exit conditions with indicators
3. Recommend risk management parameters
4. Suggest realistic backtesting settings

When analyzing backtest results:
1. Point out overfitting risks
2. Suggest parameter sensitivity analysis
3. Check for realistic assumptions
4. Recommend improvements`

function fallbackDesign(message: string): string {
  const strategy = parseNaturalLanguage(message)
  const entry = strategy.entry_rules[0]
  const conds = entry.conditions.map(
    c => `  - ${c.indicator} ${c.operator} ${c.value} (period: ${c.period})`
  ).join("\n")
  return (
    `I've parsed your strategy idea:\n\n` +
    `**Strategy:** ${strategy.name}\n` +
    `**Instrument:** ${entry.instrument}\n` +
    `**Entry conditions:**\n${conds}\n\n` +
    `**Risk Management:**\n` +
    `  - Stop Loss: ${strategy.risk_management?.stop_loss_percent || "Not set"}%\n` +
    `  - Take Profit: ${strategy.risk_management?.take_profit_percent || "Not set"}%\n\n` +
    `This has been converted to a formal strategy definition. Run a backtest to see how it performs!`
  )
}

function fallbackAnalyze(): string {
  return (
    "**Analysis Points:**\n\n" +
    "1. **Trade Count** - Few trades (<30) means statistically unreliable results\n" +
    "2. **Drawdown** - Max drawdown >20% is risky for most traders\n" +
    "3. **Win Rate vs Risk-Reward** - Low win rate needs high R:R to be profitable\n" +
    "4. **Overfitting** - If returns seem too good, the strategy may be curve-fitted\n" +
    "5. **Transaction Costs** - Indian F&O has significant costs (STT, brokerage)\n\n" +
    "**Recommendations:**\n" +
    "- Test across different market conditions\n" +
    "- Use walk-forward analysis\n" +
    "- Paper trade before going live\n" +
    "- Keep position sizes small initially"
  )
}

function fallbackOptions(): string {
  return (
    "**Options Trading Considerations:**\n\n" +
    "1. **Time Decay (Theta)** - Options lose value daily, especially weekly expiry\n" +
    "2. **Implied Volatility** - Can significantly impact option premiums\n" +
    "3. **Expiry Management** - Weekly options need more frequent management\n" +
    "4. **Margin Requirements** - F&O margins can be 20-40% of contract value\n" +
    "5. **STT on Options** - 0.05% on sell side, 0.125% on exercised options\n\n" +
    "**Strategy Suggestions:**\n" +
    "- Buy options only with clear directional bias\n" +
    "- Use spreads to reduce cost\n" +
    "- Track India VIX for volatility regime\n" +
    "- Avoid holding weekly options overnight"
  )
}

function fallbackGeneral(): string {
  return (
    "I'm the Strategy Coach! I can help you:\n\n" +
    "1. **Design a strategy** - Describe your idea in plain English\n" +
    "2. **Analyze backtest results** - Paste your results for feedback\n" +
    "3. **Optimize parameters** - Get suggestions for indicator settings\n" +
    "4. **Risk management** - Learn about position sizing and stops\n\n" +
    "Try: 'Buy NIFTY when RSI(14) < 30 and price crosses above 20 EMA. " +
    "Stop loss 1%, target 2%, intraday only'"
  )
}

function fallbackResponse(message: string): string {
  const m = message.toLowerCase()
  if (["backtest", "result", "analyze"].some(w => m.includes(w))) return fallbackAnalyze()
  if (["strategy", "design", "create", "build"].some(w => m.includes(w))) return fallbackDesign(message)
  if (["option", "ce", "pe", "straddle"].some(w => m.includes(w))) return fallbackOptions()
  return fallbackGeneral()
}

export async function chatWithCoach(userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallbackResponse(userMessage)

  try {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
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
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    if (!res.ok) return fallbackResponse(userMessage)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || fallbackResponse(userMessage)
  } catch {
    return fallbackResponse(userMessage)
  }
}

export { SYSTEM_PROMPT }
