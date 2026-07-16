import { NextRequest, NextResponse } from "next/server"
import { listInstruments } from "@/lib/data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get("source") || "synthetic"

  if (source === "synthetic" || source === "csv") {
    return NextResponse.json({ instruments: listInstruments() })
  }
  return NextResponse.json({ instruments: listInstruments() })
}
