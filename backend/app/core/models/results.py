from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TradeOrder(BaseModel):
    id: str
    timestamp: datetime
    instrument: str
    side: str
    quantity: float
    price: float
    slippage: float = 0.0
    brokerage: float = 0.0
    stt: float = 0.0
    other_charges: float = 0.0
    order_type: str = "market"
    tag: str = ""


class OpenPosition(BaseModel):
    entry_order: TradeOrder
    current_price: float = 0.0
    unrealized_pnl: float = 0.0
    highest_price: float = 0.0
    bars_held: int = 0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


class ClosedTrade(BaseModel):
    entry_order: TradeOrder
    exit_order: TradeOrder
    pnl: float = 0.0
    net_pnl: float = 0.0
    holding_bars: int = 0
    holding_time: float = 0.0
    exit_reason: str = ""


class EquityPoint(BaseModel):
    timestamp: datetime
    equity: float
    drawdown: float = 0.0


class BacktestResult(BaseModel):
    strategy_name: str
    start_date: str
    end_date: str
    initial_capital: float
    final_capital: float
    total_return_pct: float = 0.0
    cagr: float = 0.0
    max_drawdown_pct: float = 0.0
    max_drawdown_amount: float = 0.0
    volatility: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    win_rate: float = 0.0
    average_win: float = 0.0
    average_loss: float = 0.0
    profit_factor: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    avg_holding_bars: float = 0.0
    exposure_pct: float = 0.0
    total_brokerage: float = 0.0
    total_stt: float = 0.0
    equity_curve: list[EquityPoint] = Field(default_factory=list)
    trades: list[ClosedTrade] = Field(default_factory=list)
    monthly_returns: list[dict] = Field(default_factory=list)


class BacktestRequest(BaseModel):
    strategy: dict
    data_source: str = "csv"
    data_path: Optional[str] = None
    instrument: Optional[str] = None
