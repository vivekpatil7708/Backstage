'use client'

import { BacktestResult as BR } from '@/types'
import EquityChart from './EquityChart'
import TradeTable from './TradeTable'

interface Props {
  result: BR | null
}

export default function BacktestResults({ result }: Props) {
  if (!result) {
    return (
      <div className="card text-center py-16 text-gray-400">
        <p className="text-lg">No backtest results yet.</p>
        <p className="text-sm mt-2">
          Run a backtest from the Strategy Builder tab to see results here.
        </p>
      </div>
    )
  }

  const fmt = (n: number) =>
    `\u20B9${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  const pct = (n: number) => `${n.toFixed(2)}%`
  const isProfit = result.final_capital >= result.initial_capital

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{result.strategy_name}</h2>
          <span
            className={`text-sm px-3 py-1 rounded-full ${
              isProfit
                ? 'bg-green-900/30 text-green-400'
                : 'bg-red-900/30 text-red-400'
            }`}
          >
            {isProfit ? 'Profitable' : 'Losing'}
          </span>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          {result.start_date} to {result.end_date} | Capital: {fmt(result.initial_capital)}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <MetricCard label="Final Capital" value={fmt(result.final_capital)} accent={isProfit} />
          <MetricCard label="Total Return" value={pct(result.total_return_pct)} accent={result.total_return_pct >= 0} />
          <MetricCard label="CAGR" value={pct(result.cagr)} accent={result.cagr >= 0} />
          <MetricCard label="Max Drawdown" value={pct(result.max_drawdown_pct)} danger />
          <MetricCard label="Sharpe Ratio" value={result.sharpe_ratio.toFixed(2)} accent={result.sharpe_ratio >= 1} />
          <MetricCard label="Sortino Ratio" value={result.sortino_ratio.toFixed(2)} accent={result.sortino_ratio >= 1} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Trades" value={String(result.total_trades)} />
        <MetricCard label="Win Rate" value={pct(result.win_rate)} accent={result.win_rate >= 50} />
        <MetricCard label="Avg Win" value={fmt(result.average_win)} accent />
        <MetricCard label="Avg Loss" value={fmt(result.average_loss)} danger={result.average_loss < 0} />
        <MetricCard label="Profit Factor" value={result.profit_factor.toFixed(2)} accent={result.profit_factor >= 1} />
        <MetricCard label="Exposure" value={pct(result.exposure_pct)} />
      </div>

      <div className="card">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Equity Curve</h3>
        <EquityChart data={result.equity_curve} />
      </div>

      <div className="card">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Costs</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Brokerage: </span>
            <span>{fmt(result.total_brokerage)}</span>
          </div>
          <div>
            <span className="text-gray-400">STT: </span>
            <span>{fmt(result.total_stt)}</span>
          </div>
          <div>
            <span className="text-gray-400">Avg Holding: </span>
            <span>{result.avg_holding_bars.toFixed(1)} bars</span>
          </div>
        </div>
      </div>

      {result.trades.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Trade List ({result.trades.length})
          </h3>
          <TradeTable trades={result.trades} />
        </div>
      )}

      {result.monthly_returns.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Monthly Returns</h3>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {result.monthly_returns.map((m) => (
              <div
                key={m.month}
                className={`text-center text-xs p-2 rounded ${
                  m.return >= 0
                    ? 'bg-green-900/20 text-green-400'
                    : 'bg-red-900/20 text-red-400'
                }`}
              >
                <div className="font-medium">{m.month.split('-')[1]}</div>
                <div>{m.return.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            const csv = [
              'Timestamp,Equity,Drawdown',
              ...result.equity_curve.map(
                (e) => `${e.timestamp},${e.equity},${e.drawdown}`
              ),
            ].join('\n')
            download(csv, 'equity_curve.csv')
          }}
        >
          Export Equity CSV
        </button>
        <button
          onClick={() => {
            const csv = [
              'Instrument,Side,Entry Date,Entry Price,Exit Date,Exit Price,P&L,Reason',
              ...result.trades.map(
                (t) =>
                  `${t.entry_order.instrument},${t.entry_order.side},${t.entry_order.timestamp},${t.entry_order.price},${t.exit_order.timestamp},${t.exit_order.price},${t.net_pnl.toFixed(2)},${t.exit_reason}`
              ),
            ].join('\n')
            download(csv, 'trades.csv')
          }}
        >
          Export Trades CSV
        </button>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
  danger,
}: {
  label: string
  value: string
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className="bg-[#11111b] rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div
        className={`text-lg font-semibold ${
          danger ? 'text-red-400' : accent ? 'text-green-400' : 'text-gray-100'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
