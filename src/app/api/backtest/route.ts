import { NextRequest, NextResponse } from "next/server"
import { runBacktest } from "@/lib/backtest"
import { generateSyntheticData, fetchYahooData } from "@/lib/data"
import type { StrategyDefinition } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const strategy: StrategyDefinition = body.strategy
    const dataSource = body.data_source || "synthetic"
    const instrument = body.instrument || "NIFTY"
    const startDate = body.start_date || "2023-01-01"
    const endDate = body.end_date || "2024-12-31"
    const timeframe = body.timeframe || "1d"

    if (!strategy || !strategy.entry_rules || strategy.entry_rules.length === 0) {
      return NextResponse.json({ error: "Strategy must have at least one entry rule" }, { status: 400 })
    }

    let bars
    if (dataSource === "yahoo") {
      bars = await fetchYahooData(instrument, startDate, endDate, timeframe)
    } else {
      bars = generateSyntheticData(instrument, startDate, endDate)
    }

    const result = runBacktest(strategy, bars)

    const chartBars = bars.map(b => ({
      time: b.datetime.split("T")[0],
      open: b.Open,
      high: b.High,
      low: b.Low,
      close: b.Close,
      volume: b.Volume,
    }))

    const markers = result.trades.flatMap(t => [
      {
        time: t.entry_order.timestamp.split("T")[0],
        position: t.entry_order.side === "buy" ? "belowBar" as const : "aboveBar" as const,
        color: t.entry_order.side === "buy" ? "#22c55e" : "#ef4444",
        shape: t.entry_order.side === "buy" ? "arrowUp" as const : "arrowDown" as const,
        text: `${t.entry_order.side.toUpperCase()} @ ₹${t.entry_order.price.toFixed(0)}`,
      },
      {
        time: t.exit_order.timestamp.split("T")[0],
        position: t.exit_order.side === "buy" ? "belowBar" as const : "aboveBar" as const,
        color: t.net_pnl >= 0 ? "#3b82f6" : "#f97316",
        shape: t.exit_order.side === "buy" ? "arrowUp" as const : "arrowDown" as const,
        text: `${t.exit_reason} (${t.net_pnl >= 0 ? '+' : ''}₹${t.net_pnl.toFixed(0)})`,
      },
    ])

    markers.sort((a, b) => a.time.localeCompare(b.time))

    return NextResponse.json({
      run_id: 0,
      result,
      bars: chartBars,
      markers,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, trace: e.stack }, { status: 400 })
  }
}
