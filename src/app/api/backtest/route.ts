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
    return NextResponse.json({ run_id: 0, result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, trace: e.stack }, { status: 400 })
  }
}
