
from ..core.models.results import BacktestResult


def format_report(result: BacktestResult) -> str:
    lines = [
        f"{'='*60}",
        f"  BACKTEST REPORT: {result.strategy_name}",
        f"{'='*60}",
        f"  Period: {result.start_date} to {result.end_date}",
        f"{'─'*60}",
        f"  INITIAL CAPITAL      ₹{result.initial_capital:>12,.2f}",
        f"  FINAL CAPITAL        ₹{result.final_capital:>12,.2f}",
        f"  TOTAL RETURN          {result.total_return_pct:>11.2f}%",
        f"  CAGR                  {result.cagr:>11.2f}%",
        f"{'─'*60}",
        "  RISK METRICS",
        f"  Max Drawdown          {result.max_drawdown_pct:>11.2f}%",
        f"  Max DD Amount        ₹{result.max_drawdown_amount:>12,.2f}",
        f"  Volatility            {result.volatility:>11.2f}%",
        f"  Sharpe Ratio          {result.sharpe_ratio:>11.2f}",
        f"  Sortino Ratio         {result.sortino_ratio:>11.2f}",
        f"{'─'*60}",
        "  TRADE STATISTICS",
        f"  Total Trades          {result.total_trades:>11d}",
        f"  Winning Trades        {result.winning_trades:>11d}",
        f"  Losing Trades         {result.losing_trades:>11d}",
        f"  Win Rate              {result.win_rate:>11.2f}%",
        f"  Avg Win             ₹{result.average_win:>12,.2f}",
        f"  Avg Loss            ₹{result.average_loss:>12,.2f}",
        f"  Profit Factor         {result.profit_factor:>11.2f}",
        f"  Avg Holding (bars)    {result.avg_holding_bars:>11.1f}",
        f"  Exposure              {result.exposure_pct:>11.2f}%",
        f"{'─'*60}",
        "  COSTS",
        f"  Total Brokerage     ₹{result.total_brokerage:>12,.2f}",
        f"  Total STT            ₹{result.total_stt:>12,.2f}",
        f"{'='*60}",
    ]
    return "\n".join(lines)


def analyze_backtest(result: BacktestResult) -> list[str]:
    """Generate coaching insights from backtest results."""
    insights = []
    if result.total_trades < 30:
        insights.append(
            f"Low trade count ({result.total_trades}). "
            "Consider relaxing entry conditions or extending the backtest period."
        )
    if result.max_drawdown_pct > 20:
        insights.append(
            f"High drawdown ({result.max_drawdown_pct:.1f}%). "
            "Tighten stop losses or reduce position size."
        )
    if result.win_rate < 30:
        insights.append(
            f"Low win rate ({result.win_rate:.1f}%). "
            "Review entry conditions - they may be too aggressive."
        )
    if result.profit_factor < 1.0:
        insights.append(
            f"Profit factor below 1 ({result.profit_factor:.2f}). "
            "The strategy is losing money. Review risk-reward ratio."
        )
    if result.sharpe_ratio < 0.5:
        insights.append(
            f"Low Sharpe ratio ({result.sharpe_ratio:.2f}). "
            "Risk-adjusted returns are poor."
        )
    if result.total_return_pct > 100:
        insights.append(
            "Very high returns - check for unrealistic assumptions "
            "(no slippage, perfect fills, survivorship bias)."
        )
    if result.exposure_pct > 80:
        insights.append(
            f"High market exposure ({result.exposure_pct:.1f}%). "
            "Consider reducing holding periods for better risk management."
        )
    avg_win_loss = abs(result.average_win / result.average_loss) if result.average_loss != 0 else 0
    if avg_win_loss < 1.5 and result.win_rate < 50:
        insights.append(
            f"Win/Loss ratio ({avg_win_loss:.2f}) is low with low win rate. "
            "Consider increasing take profit targets."
        )
    if not insights:
        insights.append("Strategy looks reasonable. Consider walk-forward analysis for robustness.")
    return insights
