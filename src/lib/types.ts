export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1w"
export type Side = "buy" | "sell"
export type InstrumentType = "equity" | "index" | "futures" | "options_ce" | "options_pe"
export type ConditionOperator = ">" | "<" | ">=" | "<=" | "==" | "!=" | "cross_above" | "cross_below"
export type PositionSizingType = "fixed_lot" | "fixed_capital" | "percent_capital"

export interface Condition {
  indicator: string
  operator: ConditionOperator
  value: number
  period?: number
}

export interface EntryRule {
  conditions: Condition[]
  instrument: string
  instrument_type?: InstrumentType
  side: Side
  option_type?: "CE" | "PE"
  strike_offset?: number
  expiry_type?: "weekly" | "monthly"
}

export interface ExitRule {
  conditions?: Condition[]
  exit_at_end_of_day?: boolean
  exit_on_signal?: boolean
  max_bars_in_trade?: number
}

export interface RiskManagement {
  stop_loss_percent?: number
  take_profit_percent?: number
  trailing_stop_percent?: number
  trailing_step_percent?: number
  max_loss_per_day?: number
  max_positions?: number
  max_drawdown_percent?: number
}

export interface PositionSizing {
  sizing_type?: PositionSizingType
  lot_size?: number
  capital_per_trade?: number
  percent_capital?: number
  max_capital?: number
}

export interface TransactionCosts {
  brokerage_per_order?: number
  stt_percent?: number
  exchange_charges?: number
  sebi_charges?: number
  gst_percent?: number
  slippage_ticks?: number
  slippage_value?: number
}

export interface StrategyDefinition {
  name: string
  description?: string
  timeframe?: Timeframe
  initial_capital?: number
  entry_rules: EntryRule[]
  exit_rules?: ExitRule[]
  risk_management?: RiskManagement
  position_sizing?: PositionSizing
  transaction_costs?: TransactionCosts
  allow_short?: boolean
  margin_multiplier?: number
}

export interface TradeOrder {
  id: string
  timestamp: string
  instrument: string
  side: string
  quantity: number
  price: number
  slippage: number
  brokerage: number
  stt: number
  other_charges: number
  order_type?: string
  tag?: string
}

export interface OpenPosition {
  entry_order: TradeOrder
  current_price: number
  unrealized_pnl: number
  highest_price: number
  bars_held: number
}

export interface ClosedTrade {
  entry_order: TradeOrder
  exit_order: TradeOrder
  pnl: number
  net_pnl: number
  holding_bars: number
  holding_time?: number
  exit_reason?: string
}

export interface EquityPoint {
  timestamp: string
  equity: number
  drawdown: number
}

export interface BacktestResult {
  strategy_name: string
  start_date: string
  end_date: string
  initial_capital: number
  final_capital: number
  total_return_pct: number
  cagr: number
  max_drawdown_pct: number
  max_drawdown_amount: number
  volatility: number
  sharpe_ratio: number
  sortino_ratio: number
  win_rate: number
  average_win: number
  average_loss: number
  profit_factor: number
  total_trades: number
  winning_trades: number
  losing_trades: number
  avg_holding_bars: number
  exposure_pct: number
  total_brokerage: number
  total_stt: number
  equity_curve: EquityPoint[]
  trades: ClosedTrade[]
  monthly_returns: { month: string; return: number; equity: number }[]
}

export interface OHLCVBar {
  datetime: string
  Open: number
  High: number
  Low: number
  Close: number
  Volume: number
}
