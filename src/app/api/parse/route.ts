import { NextRequest, NextResponse } from "next/server"
import { parseNaturalLanguage, strategyToJSON, strategyToYAML } from "@/lib/parser"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const prompt = searchParams.get("prompt") || ""
    if (!prompt) {
      return NextResponse.json({ error: "Missing 'prompt' query parameter" }, { status: 400 })
    }
    const strategy = parseNaturalLanguage(prompt)
    return NextResponse.json({
      strategy,
      json: strategyToJSON(strategy),
      yaml: strategyToYAML(strategy),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
