'use client'

import { useState } from 'react'
import { parseStrategy, runBacktest } from '@/lib/api'
import { Strategy, BacktestResult } from '@/types'

interface Props {
  onBacktestComplete: (result: BacktestResult) => void
}

export default function StrategyBuilder({ onBacktestComplete }: Props) {
  const [mode, setMode] = useState<'prompt' | 'form'>('prompt')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsedStrategy, setParsedStrategy] = useState<Strategy | null>(null)

  const [instrument, setInstrument] = useState('NIFTY')
  const [timeframe, setTimeframe] = useState('1d')
  const [startDate, setStartDate] = useState('2023-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [capital, setCapital] = useState(100000)
  const [dataSource, setDataSource] = useState('yahoo')
  const [stopLoss, setStopLoss] = useState(2)
  const [takeProfit, setTakeProfit] = useState(4)
  const [indicator, setIndicator] = useState('rsi')
  const [indicatorPeriod, setIndicatorPeriod] = useState(14)
  const [conditionOp, setConditionOp] = useState('<')
  const [conditionVal, setConditionVal] = useState(30)
  const [side, setSide] = useState('buy')

  const handleParsePrompt = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await parseStrategy(prompt)
      setParsedStrategy(res.strategy)
      setMode('form')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const buildStrategy = (): Strategy => {
    if (parsedStrategy && mode === 'prompt') return parsedStrategy
    return {
      name: `Strategy - ${instrument}`,
      description: prompt || 'Form-defined strategy',
      timeframe,
      start_date: startDate,
      end_date: endDate,
      initial_capital: capital,
      entry_rules: [
        {
          conditions: [
            { indicator, operator: conditionOp, value: conditionVal, period: indicatorPeriod },
          ],
          instrument,
          instrument_type: instrument.includes('NIFTY') ? 'index' : 'equity',
          side,
        },
      ],
      exit_rules: [{ conditions: [], exit_at_end_of_day: false }],
      risk_management: {
        stop_loss_percent: stopLoss,
        take_profit_percent: takeProfit,
        max_positions: 1,
      },
      position_sizing: {
        sizing_type: 'fixed_capital',
        lot_size: 1,
        capital_per_trade: capital * 0.5,
      },
      transaction_costs: {
        brokerage_per_order: 20,
        stt_percent: 0.05,
        slippage_ticks: 1,
        slippage_value: 0.05,
      },
    }
  }

  const handleBacktest = async () => {
    setLoading(true)
    setError('')
    try {
      const strategy = buildStrategy()
      const res = await runBacktest({
        strategy,
        data_source: dataSource,
        instrument: strategy.entry_rules[0]?.instrument || instrument,
        start_date: strategy.start_date || startDate,
        end_date: strategy.end_date || endDate,
        timeframe: strategy.timeframe || timeframe,
      })
      onBacktestComplete(res.result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const indicators = ['rsi', 'ema', 'sma', 'macd', 'bollinger_bands', 'atr', 'adx', 'stochastic', 'supertrend', 'vwap']
  const operators = ['>', '<', '>=', '<=', '==', 'cross_above', 'cross_below']
  const instruments = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC', 'TATAMOTORS']

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('prompt')}
            className={mode === 'prompt' ? '' : 'bg-gray-700 hover:bg-gray-600'}
          >
            Natural Language
          </button>
          <button
            onClick={() => {
              setParsedStrategy(null)
              setMode('form')
            }}
            className={mode === 'form' ? '' : 'bg-gray-700 hover:bg-gray-600'}
          >
            Form Builder
          </button>
        </div>

        {mode === 'prompt' && (
          <div className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "Buy NIFTY when RSI(14) < 30 and price crosses above 20 EMA. Stop loss 1%, target 2%, intraday only"'
              className="w-full h-32 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={handleParsePrompt} disabled={loading}>
                {loading ? 'Parsing...' : 'Parse Strategy'}
              </button>
              <button
                onClick={handleBacktest}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Running...' : 'Run Backtest'}
              </button>
            </div>
          </div>
        )}

        {mode === 'form' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Instrument</label>
                <select
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                  className="w-full"
                >
                  {instruments.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Timeframe</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full"
                >
                  {['1d', '1h', '15m', '5m', '1w'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data Source</label>
                <select
                  value={dataSource}
                  onChange={(e) => setDataSource(e.target.value)}
                  className="w-full"
                >
                  <option value="yahoo">Yahoo Finance (Real)</option>
                  <option value="synthetic">Synthetic (Demo)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Initial Capital</label>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(+e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Stop Loss (%)</label>
                <input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(+e.target.value)}
                  step="0.1"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Take Profit (%)</label>
                <input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(+e.target.value)}
                  step="0.1"
                  className="w-full"
                />
              </div>
            </div>

            <div className="border-t border-[#2a2a3a] pt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Entry Condition</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Side</label>
                  <select
                    value={side}
                    onChange={(e) => setSide(e.target.value)}
                    className="w-full"
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Indicator</label>
                  <select
                    value={indicator}
                    onChange={(e) => setIndicator(e.target.value)}
                    className="w-full"
                  >
                    {indicators.map((i) => (
                      <option key={i} value={i}>
                        {i.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Period</label>
                  <input
                    type="number"
                    value={indicatorPeriod}
                    onChange={(e) => setIndicatorPeriod(+e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Condition</label>
                  <select
                    value={conditionOp}
                    onChange={(e) => setConditionOp(e.target.value)}
                    className="w-full"
                  >
                    {operators.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Value</label>
                  <input
                    type="number"
                    value={conditionVal}
                    onChange={(e) => setConditionVal(+e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {parsedStrategy && (
              <div className="bg-[#11111b] rounded-lg p-4 text-sm">
                <h4 className="font-medium text-gray-300 mb-2">Parsed Strategy</h4>
                <pre className="text-gray-400 overflow-auto max-h-48 text-xs">
                  {JSON.stringify(parsedStrategy, null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={handleBacktest}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-base px-8 py-3"
            >
              {loading ? 'Running Backtest...' : 'Run Backtest'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Quick Start Examples</h3>
        <div className="flex flex-wrap gap-2">
          {[
            'Buy NIFTY when RSI(14) < 30. Stop loss 2%, target 4%',
            'Buy BANKNIFTY CE when RSI(14) < 30. Intraday. Trailing stop 1%',
            'Sell NIFTY when RSI(14) > 70. Stop loss 1.5%, target 3%',
            'Buy RELIANCE when MACD crosses above signal. Stop loss 2%, target 5%',
          ].map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setPrompt(ex)
                setMode('prompt')
              }}
              className="bg-[#11111b] hover:bg-gray-700 text-xs text-gray-300 px-3 py-1.5 rounded-full"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
