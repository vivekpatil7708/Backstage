import { NextRequest, NextResponse } from "next/server"
import { fetchYahooData } from "@/lib/data"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instrument = searchParams.get("instrument") || "NIFTY"
    const timeframe = searchParams.get("timeframe") || "1d"
    const range = searchParams.get("range") || "1mo"

    const end = new Date()
    const start = new Date()

    switch (range) {
      case "1d":
        start.setDate(end.getDate() - (timeframe === "1d" ? 30 : 1))
        break
      case "5d": start.setDate(end.getDate() - 5); break
      case "1mo": start.setMonth(end.getMonth() - 1); break
      case "3mo": start.setMonth(end.getMonth() - 3); break
      case "6mo": start.setMonth(end.getMonth() - 6); break
      case "1y": start.setFullYear(end.getFullYear() - 1); break
      case "2y": start.setFullYear(end.getFullYear() - 2); break
      default: start.setMonth(end.getMonth() - 1)
    }

    const startDate = start.toISOString().split("T")[0]
    const endDate = end.toISOString().split("T")[0]

    const bars = await fetchYahooData(instrument, startDate, endDate, timeframe)

    const chartBars = bars.map(b => ({
      time: b.datetime.split("T")[0],
      open: b.Open,
      high: b.High,
      low: b.Low,
      close: b.Close,
      volume: b.Volume,
    }))

    const lastBar = chartBars[chartBars.length - 1]

    return NextResponse.json({
      bars: chartBars,
      lastPrice: lastBar?.close ?? null,
      lastTime: lastBar?.time ?? null,
      instrument,
      timeframe,
      range,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
