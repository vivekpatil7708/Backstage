from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class InstrumentType(str, Enum):
    EQUITY = "equity"
    INDEX = "index"
    FUTURES = "futures"
    OPTIONS_CE = "options_ce"
    OPTIONS_PE = "options_pe"


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


class Timeframe(str, Enum):
    MIN_1 = "1m"
    MIN_5 = "5m"
    MIN_15 = "15m"
    MIN_30 = "30m"
    HOUR_1 = "1h"
    DAY_1 = "1d"
    WEEK_1 = "1w"


class OptionType(str, Enum):
    CALL = "CE"
    PUT = "PE"


class ExpiryType(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ConditionOperator(str, Enum):
    GT = ">"
    LT = "<"
    GTE = ">="
    LTE = "<="
    EQ = "=="
    NEQ = "!="
    CROSS_ABOVE = "cross_above"
    CROSS_BELOW = "cross_below"


class PositionSizingType(str, Enum):
    FIXED_LOT = "fixed_lot"
    FIXED_CAPITAL = "fixed_capital"
    PERCENT_CAPITAL = "percent_capital"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class Condition(BaseModel):
    indicator: str = Field(description="Indicator name, e.g. RSI, EMA, VWAP")
    operator: ConditionOperator
    value: float | str = Field(
        description="Numeric value or another indicator reference like EMA(20)"
    )
    period: Optional[int] = None


class EntryRule(BaseModel):
    conditions: list[Condition] = Field(
        min_length=1, description="All conditions must be true simultaneously (AND logic)"
    )
    instrument: str = Field(description="e.g. NIFTY, BANKNIFTY, RELIANCE")
    instrument_type: InstrumentType = InstrumentType.EQUITY
    side: Side = Side.BUY
    option_type: Optional[OptionType] = None
    strike_offset: Optional[int] = Field(
        None, description="ATM offset: 0=ATM, -1=ITM1, 1=OTM1, etc."
    )
    expiry_type: Optional[ExpiryType] = ExpiryType.WEEKLY


class ExitRule(BaseModel):
    conditions: list[Condition] = Field(default_factory=list)
    exit_at_end_of_day: bool = False
    exit_on_signal: bool = False
    max_bars_in_trade: Optional[int] = None


class RiskManagement(BaseModel):
    stop_loss_percent: Optional[float] = Field(None, ge=0, le=100)
    take_profit_percent: Optional[float] = Field(None, ge=0, le=100)
    trailing_stop_percent: Optional[float] = Field(None, ge=0, le=100)
    trailing_step_percent: Optional[float] = None
    max_loss_per_day: Optional[float] = Field(None, ge=0)
    max_positions: int = 1
    max_drawdown_percent: Optional[float] = None


class PositionSizing(BaseModel):
    sizing_type: PositionSizingType = PositionSizingType.FIXED_LOT
    lot_size: int = 1
    capital_per_trade: Optional[float] = None
    percent_capital: Optional[float] = None
    max_capital: Optional[float] = None


class TransactionCosts(BaseModel):
    brokerage_per_order: float = 20.0
    stt_percent: float = 0.05
    exchange_charges: float = 0.003
    sebi_charges: float = 0.001
    gst_percent: float = 18.0
    slippage_ticks: int = 1
    slippage_value: float = 0.0


class StrategyDefinition(BaseModel):
    name: str
    description: str = ""
    timeframe: Timeframe = Timeframe.DAY_1
    start_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    initial_capital: float = 100000.0
    entry_rules: list[EntryRule] = Field(min_length=1)
    exit_rules: list[ExitRule] = Field(default_factory=list)
    risk_management: RiskManagement = Field(default_factory=RiskManagement)
    position_sizing: PositionSizing = Field(default_factory=PositionSizing)
    transaction_costs: TransactionCosts = Field(default_factory=TransactionCosts)
    allow_short: bool = False
    margin_multiplier: float = 1.0


class IndicatorConfig(BaseModel):
    name: str
    params: dict[str, Any] = Field(default_factory=dict)


class StrategyMeta(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    tags: list[str] = Field(default_factory=list)
    definition: StrategyDefinition
