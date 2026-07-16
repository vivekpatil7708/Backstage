import { NextResponse } from "next/server"
import { listDataSources } from "@/lib/data"

export async function GET() {
  return NextResponse.json({ sources: listDataSources() })
}
