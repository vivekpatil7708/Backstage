export interface Condition {
  indicator: string
  operator: string
  value: number | string
  period?: number
}

export interface EntryRule {
  conditions: Condition[]
  instrument: string
  instrument_type: string
  side: string
  option_type?: string
  strike_offset?: number
  expiry_type?: string
}

export interface ExitRule {
  conditions: Condition[]
  exit_at_end_of_day: boolean
  max_bars_in_trade?: number
}

export interface RiskManagement {
  stop_loss_percent?: number
  take_profit_percent?: number
  trailing_stop_percent?: number
  max_loss_per_day?: number
  max_positions: number
}

export interface PositionSizing {
  sizing_type: string
  lot_size: number
  capital_per_trade?: number
  percent_capital?: number
}

export interface TransactionCosts {
  brokerage_per_order: number
  stt_percent: number
  slippage_ticks: number
  slippage_value: number
}

export interface Strategy {
  name: string
  description: string
  timeframe: string
  start_date?: string
  end_date?: string
  initial_capital: number
  entry_rules: EntryRule[]
  exit_rules: ExitRule[]
  risk_management: RiskManagement
  position_sizing: PositionSizing
  transaction_costs: TransactionCosts
}

export interface EquityPoint {
  timestamp: string
  equity: number
  drawdown: number
}

export interface Trade {
  entry_order: {
    id: string
    timestamp: string
    instrument: string
    side: string
    quantity: number
    price: number
  }
  exit_order: {
    id: string
    timestamp: string
    side: string
    price: number
  }
  pnl: number
  net_pnl: number
  holding_bars: number
  exit_reason: string
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
  trades: Trade[]
  monthly_returns: { month: string; return: number; equity: number }[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
