import os
from typing import Optional

from ..strategies.parser import parse_natural_language


class StrategyCoach:
    def __init__(self):
        self.system_prompt = """You are an expert Indian stock market trading strategy coach.
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
4. Recommend improvements"""

        self.coaching_prompt = """Analyze this backtest result and provide coaching:
{result}

Provide:
1. Strengths of the strategy
2. Weaknesses and risks
3. Specific improvements
4. Whether it's realistic for live trading"""

    async def chat(self, user_message: str, history: Optional[list] = None) -> str:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

            messages = [{"role": "system", "content": self.system_prompt}]
            if history:
                messages.extend(history)
            messages.append({"role": "user", "content": user_message})

            response = await client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=messages,
                temperature=0.7,
                max_tokens=1500,
            )
            return response.choices[0].message.content
        except Exception:
            return self._fallback_response(user_message)

    def _fallback_response(self, message: str) -> str:
        msg_lower = message.lower()

        if any(w in msg_lower for w in ["backtest", "result", "analyze"]):
            return self._analyze_fallback(message)
        if any(w in msg_lower for w in ["strategy", "design", "create", "build"]):
            return self._design_fallback(message)
        if any(w in msg_lower for w in ["option", "ce", "pe", "straddle"]):
            return self._options_fallback(message)

        return (
            "I'm the Strategy Coach! I can help you:\n\n"
            "1. **Design a strategy** - Describe your idea in plain English\n"
            "2. **Analyze backtest results** - Paste your results for feedback\n"
            "3. **Optimize parameters** - Get suggestions for indicator settings\n"
            "4. **Risk management** - Learn about position sizing and stops\n\n"
            "Try: 'Buy NIFTY when RSI(14) < 30 and price crosses above 20 EMA. "
            "Stop loss 1%, target 2%, intraday only'"
        )

    def _design_fallback(self, message: str) -> str:
        strategy = parse_natural_language(message)
        return (
            f"I've parsed your strategy idea:\n\n"
            f"**Strategy:** {strategy.name}\n"
            f"**Instrument:** {strategy.entry_rules[0].instrument}\n"
            f"**Entry conditions:**\n"
            + "\n".join(
                f"  - {c.indicator} {c.operator.value} {c.value} (period: {c.period})"
                for c in strategy.entry_rules[0].conditions
            )
            + f"\n\n**Risk Management:**\n"
            f"  - Stop Loss: {strategy.risk_management.stop_loss_percent or 'Not set'}%\n"
            f"  - Take Profit: {strategy.risk_management.take_profit_percent or 'Not set'}%\n\n"
            "This has been converted to a formal strategy definition. "
            "Run a backtest to see how it performs!"
        )

    def _analyze_fallback(self, message: str) -> str:
        return (
            "**Analysis Points:**\n\n"
            "1. **Trade Count** - Few trades (<30) means statistically unreliable results\n"
            "2. **Drawdown** - Max drawdown >20% is risky for most traders\n"
            "3. **Win Rate vs Risk-Reward** - Low win rate needs high R:R to be profitable\n"
            "4. **Overfitting** - If returns seem too good, the strategy may be curve-fitted\n"
            "5. **Transaction Costs** - Indian F&O has significant costs (STT, brokerage)\n\n"
            "**Recommendations:**\n"
            "- Test across different market conditions\n"
            "- Use walk-forward analysis\n"
            "- Paper trade before going live\n"
            "- Keep position sizes small initially"
        )

    def _options_fallback(self, message: str) -> str:
        return (
            "**Options Trading Considerations:**\n\n"
            "1. **Time Decay (Theta)** - Options lose value daily, especially weekly expiry\n"
            "2. **Implied Volatility** - Can significantly impact option premiums\n"
            "3. **Expiry Management** - Weekly options need more frequent management\n"
            "4. **Margin Requirements** - F&O margins can be 20-40% of contract value\n"
            "5. **STT on Options** - 0.05% on sell side, 0.125% on exercised options\n\n"
            "**Strategy Suggestions:**\n"
            "- Buy options only with clear directional bias\n"
            "- Use spreads to reduce cost\n"
            "- Track India VIX for volatility regime\n"
            "- Avoid holding weekly options overnight"
        )


strategy_coach = StrategyCoach()
