import uuid
from datetime import datetime

import pandas as pd

from ..indicators.technical import compute_indicator
from ..models.results import (
    BacktestResult,
    ClosedTrade,
    EquityPoint,
    OpenPosition,
    TradeOrder,
)
from ..models.strategy import (
    Condition,
    ConditionOperator,
    StrategyDefinition,
)


class BacktestEngine:
    def __init__(self, strategy: StrategyDefinition, data: pd.DataFrame):
        self.strategy = strategy
        self.data = data.copy()
        self.capital = strategy.initial_capital
        self.equity = strategy.initial_capital
        self.peak_equity = strategy.initial_capital
        self.positions: list[OpenPosition] = []
        self.closed_trades: list[ClosedTrade] = []
        self.equity_curve: list[EquityPoint] = []
        self.total_brokerage = 0.0
        self.total_stt = 0.0
        self._indicator_cache: dict[str, pd.Series | pd.DataFrame] = {}
        self._prepare_data()

    def _prepare_data(self):
        for rule in self.strategy.entry_rules:
            for cond in rule.conditions:
                self._ensure_indicator(cond.indicator, cond.period or 14)
        for rule in self.strategy.exit_rules:
            for cond in rule.conditions:
                self._ensure_indicator(cond.indicator, cond.period or 14)

    def _ensure_indicator(self, name: str, period: int):
        cache_key = f"{name}_{period}"
        if cache_key not in self._indicator_cache:
            self._indicator_cache[cache_key] = compute_indicator(
                name, self.data, {"period": period}
            )

    def _get_indicator_value(
        self, name: str, period: int, idx: int
    ) -> float:
        cache_key = f"{name}_{period}"
        if cache_key not in self._indicator_cache:
            self._ensure_indicator(name, period)
        series = self._indicator_cache[cache_key]
        if isinstance(series, pd.DataFrame):
            if name == "macd":
                return float(series["macd"].iloc[idx]) if idx < len(series) else 0.0
            return 0.0
        val = series.iloc[idx]
        return float(val) if pd.notna(val) else 0.0

    def _evaluate_condition(self, cond: Condition, idx: int) -> bool:
        actual_val = self._get_indicator_value(cond.indicator, cond.period or 14, idx)
        try:
            target_val = float(cond.value) if isinstance(cond.value, (int, float, str)) else 0.0
        except (ValueError, TypeError):
            target_val = 0.0

        if cond.operator == ConditionOperator.GT:
            return actual_val > target_val
        elif cond.operator == ConditionOperator.LT:
            return actual_val < target_val
        elif cond.operator == ConditionOperator.GTE:
            return actual_val >= target_val
        elif cond.operator == ConditionOperator.LTE:
            return actual_val <= target_val
        elif cond.operator == ConditionOperator.EQ:
            return abs(actual_val - target_val) < 1e-8
        elif cond.operator == ConditionOperator.NEQ:
            return abs(actual_val - target_val) >= 1e-8
        elif cond.operator == ConditionOperator.CROSS_ABOVE:
            if idx < 1:
                return False
            prev = self._get_indicator_value(cond.indicator, cond.period or 14, idx - 1)
            return prev <= target_val and actual_val > target_val
        elif cond.operator == ConditionOperator.CROSS_BELOW:
            if idx < 1:
                return False
            prev = self._get_indicator_value(cond.indicator, cond.period or 14, idx - 1)
            return prev >= target_val and actual_val < target_val
        return False

    def _evaluate_conditions(self, conditions: list[Condition], idx: int) -> bool:
        return all(self._evaluate_condition(c, idx) for c in conditions)

    def _calculate_charges(self, price: float, quantity: float, side: str) -> dict:
        tc = self.strategy.transaction_costs
        turnover = price * quantity
        brokerage = tc.brokerage_per_order
        stt = turnover * (tc.stt_percent / 100)
        exchange = turnover * (tc.exchange_charges / 100)
        sebi = turnover * (tc.sebi_charges / 100)
        gst = (brokerage + exchange) * (tc.gst_percent / 100)
        slippage = tc.slippage_ticks * tc.slippage_value * quantity
        return {
            "brokerage": brokerage,
            "stt": stt,
            "other_charges": exchange + sebi + gst,
            "slippage": slippage,
        }

    def _fill_order(
        self, timestamp: datetime, instrument: str, side: str,
        quantity: float, price: float, tag: str = "",
    ) -> TradeOrder:
        tc = self.strategy.transaction_costs
        slippage = tc.slippage_ticks * tc.slippage_value
        fill_price = price + slippage if side == "buy" else price - slippage
        charges = self._calculate_charges(fill_price, quantity, side)
        total_cost = charges["brokerage"] + charges["stt"] + charges["other_charges"]
        if side == "buy":
            self.capital -= fill_price * quantity + total_cost
        else:
            self.capital += fill_price * quantity - total_cost
        self.total_brokerage += charges["brokerage"]
        self.total_stt += charges["stt"]

        return TradeOrder(
            id=str(uuid.uuid4()),
            timestamp=timestamp,
            instrument=instrument,
            side=side,
            quantity=quantity,
            price=fill_price,
            slippage=charges["slippage"],
            brokerage=charges["brokerage"],
            stt=charges["stt"],
            other_charges=charges["other_charges"],
            tag=tag,
        )

    def _compute_position_pnl(self, pos: OpenPosition, current_price: float) -> float:
        entry_price = pos.entry_order.price
        qty = pos.entry_order.quantity
        if pos.entry_order.side == "buy":
            return (current_price - entry_price) * qty
        else:
            return (entry_price - current_price) * qty

    def _check_exit_conditions(self, pos: OpenPosition, idx: int) -> str | None:
        current_price = float(self.data["Close"].iloc[idx])
        rm = self.strategy.risk_management

        if rm.stop_loss_percent and pos.entry_order.side == "buy":
            sl_price = pos.entry_order.price * (1 - rm.stop_loss_percent / 100)
            if current_price <= sl_price:
                return "stop_loss"
        elif rm.stop_loss_percent and pos.entry_order.side == "sell":
            sl_price = pos.entry_order.price * (1 + rm.stop_loss_percent / 100)
            if current_price >= sl_price:
                return "stop_loss"

        if rm.take_profit_percent and pos.entry_order.side == "buy":
            tp_price = pos.entry_order.price * (1 + rm.take_profit_percent / 100)
            if current_price >= tp_price:
                return "take_profit"
        elif rm.take_profit_percent and pos.entry_order.side == "sell":
            tp_price = pos.entry_order.price * (1 - rm.take_profit_percent / 100)
            if current_price <= tp_price:
                return "take_profit"

        if rm.trailing_stop_percent:
            if pos.entry_order.side == "buy":
                trail_price = pos.highest_price * (1 - rm.trailing_stop_percent / 100)
                if current_price <= trail_price:
                    return "trailing_stop"
            else:
                trail_price = pos.highest_price * (1 + rm.trailing_stop_percent / 100)
                if current_price >= trail_price:
                    return "trailing_stop"

        for rule in self.strategy.exit_rules:
            if rule.max_bars_in_trade and pos.bars_held >= rule.max_bars_in_trade:
                return "max_bars"
            if rule.exit_at_end_of_day:
                ts = self.data.index[idx]
                if hasattr(ts, "hour") and ts.hour >= 15 and ts.minute >= 15:
                    return "eod"
            if rule.conditions and self._evaluate_conditions(rule.conditions, idx):
                return "signal"

        return None

    def _get_quantity(self) -> float:
        ps = self.strategy.position_sizing
        if ps.sizing_type.value == "fixed_lot":
            return float(ps.lot_size)
        elif ps.sizing_type.value == "fixed_capital":
            price = float(self.data["Close"].iloc[0])
            return max(1, int((ps.capital_per_trade or 100000) / price))
        elif ps.sizing_type.value == "percent_capital":
            price = float(self.data["Close"].iloc[0])
            alloc = self.equity * (ps.percent_capital or 10) / 100
            return max(1, int(alloc / price))
        return 1.0

    def run(self) -> BacktestResult:
        for idx in range(len(self.data)):
            ts = self.data.index[idx]
            current_price = float(self.data["Close"].iloc[idx])

            closed_indices = []
            for i, pos in enumerate(self.positions):
                if current_price > pos.highest_price:
                    pos.highest_price = current_price
                pos.bars_held += 1
                pos.current_price = current_price
                pos.unrealized_pnl = self._compute_position_pnl(pos, current_price)

                exit_reason = self._check_exit_conditions(pos, idx)
                if exit_reason:
                    exit_order = self._fill_order(
                        ts, pos.entry_order.instrument,
                        "sell" if pos.entry_order.side == "buy" else "buy",
                        pos.entry_order.quantity, current_price, exit_reason,
                    )
                    net_pnl = pos.unrealized_pnl - exit_order.brokerage - exit_order.stt - exit_order.other_charges
                    self.closed_trades.append(ClosedTrade(
                        entry_order=pos.entry_order,
                        exit_order=exit_order,
                        pnl=pos.unrealized_pnl,
                        net_pnl=net_pnl,
                        holding_bars=pos.bars_held,
                        exit_reason=exit_reason,
                    ))
                    self.equity += pos.unrealized_pnl
                    closed_indices.append(i)

            for i in reversed(closed_indices):
                self.positions.pop(i)

            rm = self.strategy.risk_management
            daily_loss = 0
            for trade in self.closed_trades:
                if hasattr(trade.exit_order.timestamp, "date") and \
                   hasattr(ts, "date") and \
                   trade.exit_order.timestamp.date() == ts.date():
                    if trade.net_pnl < 0:
                        daily_loss += abs(trade.net_pnl)

            if rm.max_loss_per_day and daily_loss >= rm.max_loss_per_day:
                self.equity_curve.append(EquityPoint(
                    timestamp=ts, equity=self.equity, drawdown=0.0
                ))
                continue

            if len(self.positions) < rm.max_positions:
                for rule in self.strategy.entry_rules:
                    if self._evaluate_conditions(rule.conditions, idx):
                        qty = self._get_quantity()
                        order = self._fill_order(
                            ts, rule.instrument, rule.side.value,
                            qty, current_price, "entry",
                        )
                        self.positions.append(OpenPosition(
                            entry_order=order,
                            current_price=current_price,
                            highest_price=current_price,
                        ))
                        break

            if self.equity > self.peak_equity:
                self.peak_equity = self.equity
            dd = (self.peak_equity - self.equity) / self.peak_equity if self.peak_equity > 0 else 0
            self.equity_curve.append(EquityPoint(
                timestamp=ts, equity=self.equity, drawdown=dd * 100
            ))

        for pos in list(self.positions):
            last_price = float(self.data["Close"].iloc[-1])
            exit_order = self._fill_order(
                self.data.index[-1], pos.entry_order.instrument,
                "sell" if pos.entry_order.side == "buy" else "buy",
                pos.entry_order.quantity, last_price, "end_of_backtest",
            )
            pnl = self._compute_position_pnl(pos, last_price)
            self.closed_trades.append(ClosedTrade(
                entry_order=pos.entry_order,
                exit_order=exit_order,
                pnl=pnl,
                net_pnl=pnl - exit_order.brokerage - exit_order.stt,
                holding_bars=pos.bars_held,
                exit_reason="end_of_backtest",
            ))
        self.positions.clear()

        return self._compute_results()

    def _compute_results(self) -> BacktestResult:
        s = self.strategy
        trades = self.closed_trades
        n = len(trades)
        wins = [t for t in trades if t.net_pnl > 0]
        losses = [t for t in trades if t.net_pnl <= 0]

        total_days = (self.data.index[-1] - self.data.index[0]).days
        years = max(total_days / 365.25, 0.01)

        final = self.equity
        total_return = ((final - s.initial_capital) / s.initial_capital) * 100
        cagr = ((final / s.initial_capital) ** (1 / years) - 1) * 100

        eq_series = [e.equity for e in self.equity_curve]
        dd_series = [e.drawdown for e in self.equity_curve]
        max_dd = max(dd_series) if dd_series else 0

        daily_returns = []
        for i in range(1, len(eq_series)):
            if eq_series[i - 1] > 0:
                daily_returns.append((eq_series[i] - eq_series[i - 1]) / eq_series[i - 1])
        import numpy as np
        daily_ret_arr = np.array(daily_returns) if daily_returns else np.array([0])
        volatility = float(np.std(daily_ret_arr) * np.sqrt(252) * 100)
        avg_ret = float(np.mean(daily_ret_arr))
        downside = daily_ret_arr[daily_ret_arr < 0]
        downside_vol = float(np.std(downside) * np.sqrt(252)) if len(downside) > 0 else 1e-10
        sharpe = (avg_ret * 252) / (float(np.std(daily_ret_arr) * np.sqrt(252)) if np.std(daily_ret_arr) > 0 else 1e-10)
        sortino = (avg_ret * 252) / downside_vol

        avg_win = sum(t.net_pnl for t in wins) / len(wins) if wins else 0
        avg_loss = sum(t.net_pnl for t in losses) / len(losses) if losses else 0
        gross_profit = sum(t.net_pnl for t in wins)
        gross_loss = abs(sum(t.net_pnl for t in losses))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
        win_rate = (len(wins) / n * 100) if n > 0 else 0
        avg_bars = sum(t.holding_bars for t in trades) / n if n > 0 else 0

        trading_days = len(eq_series)
        days_in_position = sum(1 for t in trades for _ in range(t.holding_bars))
        exposure = (days_in_position / trading_days * 100) if trading_days > 0 else 0

        monthly = {}
        for e in self.equity_curve:
            key = e.timestamp.strftime("%Y-%m")
            monthly[key] = e.equity

        monthly_returns = []
        prev = s.initial_capital
        for month, eq in sorted(monthly.items()):
            ret = ((eq - prev) / prev * 100) if prev > 0 else 0
            monthly_returns.append({"month": month, "return": round(ret, 2), "equity": round(eq, 2)})
            prev = eq

        return BacktestResult(
            strategy_name=s.name,
            start_date=str(self.data.index[0].date()),
            end_date=str(self.data.index[-1].date()),
            initial_capital=s.initial_capital,
            final_capital=round(final, 2),
            total_return_pct=round(total_return, 2),
            cagr=round(cagr, 2),
            max_drawdown_pct=round(max_dd, 2),
            max_drawdown_amount=round(self.peak_equity * max_dd / 100, 2),
            volatility=round(volatility, 2),
            sharpe_ratio=round(sharpe, 2),
            sortino_ratio=round(sortino, 2),
            win_rate=round(win_rate, 2),
            average_win=round(avg_win, 2),
            average_loss=round(avg_loss, 2),
            profit_factor=round(profit_factor, 2),
            total_trades=n,
            winning_trades=len(wins),
            losing_trades=len(losses),
            avg_holding_bars=round(avg_bars, 1),
            exposure_pct=round(exposure, 2),
            total_brokerage=round(self.total_brokerage, 2),
            total_stt=round(self.total_stt, 2),
            equity_curve=self.equity_curve,
            trades=trades,
            monthly_returns=monthly_returns,
        )
