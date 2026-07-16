import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    indicators: [
      "sma", "ema", "rsi", "macd", "bollinger_bands",
      "atr", "stochastic", "vwap", "supertrend", "adx",
    ],
  })
}
