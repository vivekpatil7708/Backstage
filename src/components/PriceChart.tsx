'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type SeriesMarker,
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
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
]

const RANGE_OPTIONS = [
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

  const [bars, setBars] = useState(initialBars)
  const [markers, setMarkers] = useState(initialMarkers)
  const [showVolume, setShowVolume] = useState(true)
  const [selectedIndicator, setSelectedIndicator] = useState<string>('none')
  const [indicatorPeriod, setIndicatorPeriod] = useState(14)

  const [liveMode, setLiveMode] = useState(false)
  const [liveRange, setLiveRange] = useState('1mo')
  const [refreshInterval, setRefreshInterval] = useState('30')
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [lastPrice, setLastPrice] = useState<number | null>(null)
  const [prevPrice, setPrevPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchLiveData = useCallback(async (range: string) => {
    if (!instrument) return
    setLoading(true)
    setError('')
    try {
      const tf = timeframe || '1d'
      const res = await fetch(`/api/data/live?instrument=${instrument}&timeframe=${tf}&range=${range}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setPrevPrice(lastPrice)
      setBars(data.bars)
      setMarkers([])
      setLastPrice(data.lastPrice)
      setLastUpdate(new Date().toLocaleTimeString())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [instrument, timeframe, lastPrice])

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

  useEffect(() => {
    if (liveMode) {
      setBars(initialBars)
    }
  }, [initialBars])

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return

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

    const candlestick = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    candlestick.setData(
      bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    )

    if (markers.length > 0) {
      const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
        time: m.time as Time,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
        size: 1,
      }))
      createSeriesMarkers(candlestick, seriesMarkers)
    }

    candleSeriesRef.current = candlestick

    let volumeSeries: ISeriesApi<'Histogram'> | null = null
    if (showVolume) {
      volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      volumeSeries.setData(
        bars.map((b) => ({
          time: b.time as Time,
          value: b.volume,
          color: b.close >= b.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
        }))
      )
      volumeSeriesRef.current = volumeSeries
    }

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    chartRef.current = chart

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [bars, markers, showVolume])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || bars.length === 0 || selectedIndicator === 'none') return

    const closes = bars.map((b) => b.close)
    let values: number[] = []

    if (selectedIndicator === 'sma') {
      values = computeSMA(closes, indicatorPeriod)
    } else if (selectedIndicator === 'ema') {
      values = computeEMA(closes, indicatorPeriod)
    } else if (selectedIndicator === 'rsi') {
      values = computeRSI(closes, indicatorPeriod)
    }

    if (values.length === 0) return

    const color =
      selectedIndicator === 'rsi'
        ? '#a855f7'
        : selectedIndicator === 'ema'
          ? '#3b82f6'
          : '#eab308'

    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const data = bars
      .map((b, i) => ({
        time: b.time as Time,
        value: values[i],
      }))
      .filter((d) => !isNaN(d.value))

    series.setData(data)

    return () => {
      chart.removeSeries(series)
    }
  }, [bars, selectedIndicator, indicatorPeriod])

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
            <span className="text-xs text-gray-400">LTP</span>
            <span className={`text-sm font-mono font-bold ${
              prevPrice !== null
                ? lastPrice > prevPrice
                  ? 'text-green-400'
                  : lastPrice < prevPrice
                    ? 'text-red-400'
                    : 'text-gray-100'
                : 'text-gray-100'
            }`}>
              ₹{lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {prevPrice !== null && lastPrice !== prevPrice && (
              <span className={`text-[10px] ${
                lastPrice > prevPrice ? 'text-green-400' : 'text-red-400'
              }`}>
                {lastPrice > prevPrice ? '▲' : '▼'} {Math.abs(lastPrice - prevPrice).toFixed(2)}
              </span>
            )}
          </div>
        )}

        {!liveMode && markers.length > 0 && (
          <span className="text-xs text-gray-500 ml-auto">{markers.length} trade markers</span>
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
