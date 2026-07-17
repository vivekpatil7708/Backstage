'use client'

import { useEffect, useRef, useState } from 'react'
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
}

export default function PriceChart({ bars, markers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [showVolume, setShowVolume] = useState(true)
  const [selectedIndicator, setSelectedIndicator] = useState<string>('none')
  const [indicatorPeriod, setIndicatorPeriod] = useState(14)

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
        {markers.length > 0 && (
          <span className="text-xs text-gray-500">{markers.length} trade markers</span>
        )}
      </div>
      <div ref={containerRef} className="rounded-lg overflow-hidden" />
    </div>
  )
}

function computeSMA(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
      continue
    }
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
    if (i < period - 1) {
      result.push(NaN)
      continue
    }
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
