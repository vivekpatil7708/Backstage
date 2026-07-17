'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
  type SeriesMarker,
  type CandlestickData,
  type HistogramData,
} from 'lightweight-charts'

interface Bar {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Marker {
  time: string
  position: 'aboveBar' | 'belowBar'
  color: string
  shape: 'arrowUp' | 'arrowDown' | 'circle'
  text: string
}

interface Props {
  bars: Bar[]
  markers: Marker[]
  instrument?: string
  timeframe?: string
}

const REFRESH_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '1', label: '1s' },
  { value: '5', label: '5s' },
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
]

const RANGE_OPTIONS = [
  { value: '1d', label: '1D' },
  { value: '5d', label: '5D' },
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
]

export default function PriceChart({ bars: initialBars, markers: initialMarkers, instrument, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const indicatorSeriesRef = useRef<any>(null)
  const isInitialMount = useRef(true)
  const isLiveUpdate = useRef(false)

  const [showVolume, setShowVolume] = useState(true)
  const [selectedIndicator, setSelectedIndicator] = useState<string>('none')
  const [indicatorPeriod, setIndicatorPeriod] = useState(14)

  const [liveMode, setLiveMode] = useState(false)
  const [liveRange, setLiveRange] = useState('1d')
  const [refreshInterval, setRefreshInterval] = useState('1')
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [lastPrice, setLastPrice] = useState<number | null>(null)
  const [prevPrice, setPrevPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState(0)
  const [marketState, setMarketState] = useState('UNKNOWN')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const barsDataRef = useRef(initialBars)

  const saveVisibleRange = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return null
    return chart.timeScale().getVisibleRange() as { from: Time; to: Time } | null
  }, [])

  const restoreVisibleRange = useCallback((range: { from: Time; to: Time } | null) => {
    if (!range) return
    const chart = chartRef.current
    if (!chart) return
    chart.timeScale().setVisibleRange(range)
  }, [])

  const buildCandleData = (b: Bar): CandlestickData<Time> => ({
    time: b.time as Time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  })

  const buildVolumeData = (b: Bar): HistogramData<Time> => ({
    time: b.time as Time,
    value: b.volume,
    color: b.close >= b.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
  })

  const fetchLiveData = useCallback(async (range: string) => {
    if (!instrument) return
    setLoading(true)
    setError('')
    try {
      const tf = timeframe || '1d'
      const res = await fetch(`/api/data/live?instrument=${instrument}&timeframe=${tf}&range=${range}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const newBars: Bar[] = data.bars
      const range2 = saveVisibleRange()

      barsDataRef.current = newBars

      const candle = candleSeriesRef.current
      if (candle) {
        candle.setData(newBars.map(buildCandleData))
      }

      const vol = volumeSeriesRef.current
      if (vol && showVolume) {
        vol.setData(newBars.map(buildVolumeData))
      }

      if (indicatorSeriesRef.current && selectedIndicator !== 'none') {
        const closes = newBars.map(b => b.close)
        let values: number[] = []
        if (selectedIndicator === 'sma') values = computeSMA(closes, indicatorPeriod)
        else if (selectedIndicator === 'ema') values = computeEMA(closes, indicatorPeriod)
        else if (selectedIndicator === 'rsi') values = computeRSI(closes, indicatorPeriod)

        indicatorSeriesRef.current.setData(
          newBars
            .map((b, i) => ({ time: b.time as Time, value: values[i] }))
            .filter(d => !isNaN(d.value))
        )
      }

      isLiveUpdate.current = true
      setPrevPrice(prev => {
        setLastPrice(data.lastPrice)
        return prev
      })
      setPriceChange(data.change || 0)
      setMarketState(data.marketState || 'UNKNOWN')
      setLastUpdate(new Date().toLocaleTimeString())

      requestAnimationFrame(() => {
        restoreVisibleRange(range2)
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [instrument, timeframe, showVolume, selectedIndicator, indicatorPeriod, saveVisibleRange, restoreVisibleRange])

  useEffect(() => {
    if (liveMode && instrument) {
      fetchLiveData(liveRange)
    }
  }, [liveMode, liveRange, instrument])

  useEffect(() => {
    if (!liveMode || refreshInterval === '0') return
    const ms = parseInt(refreshInterval) * 1000
    const id = setInterval(() => fetchLiveData(liveRange), ms)
    return () => clearInterval(id)
  }, [liveMode, refreshInterval, liveRange, fetchLiveData])

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return
    if (chartRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 450,
      layout: {
        background: { color: '#0d0d1a' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1a1a2e' },
        horzLines: { color: '#1a1a2e' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#3b82f6', width: 1, style: 2 },
        horzLine: { color: '#3b82f6', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#2a2a3a',
      },
      timeScale: {
        borderColor: '#2a2a3a',
        timeVisible: false,
      },
    })

    chartRef.current = chart

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      indicatorSeriesRef.current = null
    }
  }, [])

  // Create candle + volume series once, then update data
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || initialBars.length === 0) return

    const range = saveVisibleRange()

    if (!candleSeriesRef.current) {
      const candlestick = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      })
      candleSeriesRef.current = candlestick
      candlestick.setData(initialBars.map(buildCandleData))
    } else if (isInitialMount.current || !isLiveUpdate.current) {
      candleSeriesRef.current.setData(initialBars.map(buildCandleData))
    }

    if (initialMarkers.length > 0 && candleSeriesRef.current) {
      const seriesMarkers: SeriesMarker<Time>[] = initialMarkers.map((m) => ({
        time: m.time as Time,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
        size: 1,
      }))
      createSeriesMarkers(candleSeriesRef.current, seriesMarkers)
    }

    if (showVolume && !volumeSeriesRef.current) {
      const vol = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      vol.setData(initialBars.map(buildVolumeData))
      volumeSeriesRef.current = vol
    } else if (showVolume && volumeSeriesRef.current && !isLiveUpdate.current) {
      volumeSeriesRef.current.setData(initialBars.map(buildVolumeData))
    } else if (!showVolume && volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current)
      volumeSeriesRef.current = null
    }

    barsDataRef.current = initialBars

    if (!isLiveUpdate.current) {
      if (isInitialMount.current) {
        chart.timeScale().fitContent()
        isInitialMount.current = false
      } else {
        restoreVisibleRange(range)
      }
    }
    isLiveUpdate.current = false
  }, [initialBars, initialMarkers, showVolume, saveVisibleRange, restoreVisibleRange])

  // Update indicator series
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || barsDataRef.current.length === 0) return

    if (selectedIndicator === 'none') {
      if (indicatorSeriesRef.current) {
        chart.removeSeries(indicatorSeriesRef.current)
        indicatorSeriesRef.current = null
      }
      return
    }

    const closes = barsDataRef.current.map(b => b.close)
    let values: number[] = []
    if (selectedIndicator === 'sma') values = computeSMA(closes, indicatorPeriod)
    else if (selectedIndicator === 'ema') values = computeEMA(closes, indicatorPeriod)
    else if (selectedIndicator === 'rsi') values = computeRSI(closes, indicatorPeriod)

    const color =
      selectedIndicator === 'rsi' ? '#a855f7' :
      selectedIndicator === 'ema' ? '#3b82f6' : '#eab308'

    if (indicatorSeriesRef.current) {
      indicatorSeriesRef.current.applyOptions({ color })
      indicatorSeriesRef.current.setData(
        barsDataRef.current
          .map((b, i) => ({ time: b.time as Time, value: values[i] }))
          .filter(d => !isNaN(d.value))
      )
    } else {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      series.setData(
        barsDataRef.current
          .map((b, i) => ({ time: b.time as Time, value: values[i] }))
          .filter(d => !isNaN(d.value))
      )
      indicatorSeriesRef.current = series
    }
  }, [barsDataRef.current, selectedIndicator, indicatorPeriod])

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {instrument && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiveMode(!liveMode)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                liveMode
                  ? 'border-green-500 bg-green-900/30 text-green-400'
                  : 'border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${liveMode ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              Live
            </button>
            {liveMode && (
              <>
                <div className="flex gap-1">
                  {RANGE_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setLiveRange(r.value)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        liveRange === r.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#1a1a2e] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value)}
                  className="text-[10px] bg-[#1a1a2e] border border-gray-700 rounded px-1 py-0.5"
                >
                  {REFRESH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {lastUpdate && (
                  <span className="text-[10px] text-gray-500">Updated {lastUpdate}</span>
                )}
                {loading && <span className="text-[10px] text-blue-400">Fetching...</span>}
                {error && <span className="text-[10px] text-red-400">{error}</span>}
              </>
            )}
          </div>
        )}

        {liveMode && lastPrice !== null && (
          <div className="flex items-center gap-2 ml-auto">
            {marketState && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                marketState === 'REGULAR' ? 'bg-green-900/30 text-green-400' :
                marketState === 'PRE' ? 'bg-yellow-900/30 text-yellow-400' :
                marketState === 'POST' ? 'bg-orange-900/30 text-orange-400' :
                'bg-gray-800 text-gray-500'
              }`}>
                {marketState === 'REGULAR' ? 'LIVE' :
                 marketState === 'PRE' ? 'PRE' :
                 marketState === 'POST' ? 'POST' : marketState}
              </span>
            )}
            <span className="text-xs text-gray-400">LTP</span>
            <span className={`text-sm font-mono font-bold ${
              priceChange > 0
                ? 'text-green-400'
                : priceChange < 0
                  ? 'text-red-400'
                  : 'text-gray-100'
            }`}>
              ₹{lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {priceChange !== 0 && (
              <span className={`text-[10px] font-mono ${
                priceChange > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {priceChange > 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)} ({Math.abs(priceChange / lastPrice * 100).toFixed(2)}%)
              </span>
            )}
          </div>
        )}

        {!liveMode && initialMarkers.length > 0 && (
          <span className="text-xs text-gray-500 ml-auto">{initialMarkers.length} trade markers</span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <select
          value={selectedIndicator}
          onChange={(e) => setSelectedIndicator(e.target.value)}
          className="text-xs"
        >
          <option value="none">No Indicator</option>
          <option value="sma">SMA</option>
          <option value="ema">EMA</option>
          <option value="rsi">RSI</option>
        </select>
        {selectedIndicator !== 'none' && (
          <input
            type="number"
            value={indicatorPeriod}
            onChange={(e) => setIndicatorPeriod(+e.target.value)}
            className="w-16 text-xs"
            min={1}
            max={200}
          />
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showVolume}
            onChange={(e) => setShowVolume(e.target.checked)}
            className="rounded"
          />
          Volume
        </label>
      </div>
      <div ref={containerRef} className="rounded-lg overflow-hidden" />
    </div>
  )
}

function computeSMA(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j]
    result.push(sum / period)
  }
  return result
}

function computeEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = NaN
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    if (i === period - 1) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += data[j]
      prev = sum / period
      result.push(prev)
      continue
    }
    prev = data[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

function computeRSI(data: number[], period: number): number[] {
  const deltas: number[] = []
  for (let i = 1; i < data.length; i++) deltas.push(data[i] - data[i - 1])
  const gains = deltas.map((d) => (d > 0 ? d : 0))
  const losses = deltas.map((d) => (d < 0 ? -d : 0))
  const avgGains = computeEMA(gains, period)
  const avgLosses = computeEMA(losses, period)
  const rsi: number[] = [NaN]
  for (let i = 0; i < avgGains.length; i++) {
    if (isNaN(avgGains[i]) || isNaN(avgLosses[i]) || avgLosses[i] === 0) {
      rsi.push(NaN)
      continue
    }
    const rs = avgGains[i] / avgLosses[i]
    rsi.push(100 - 100 / (1 + rs))
  }
  return rsi
}
