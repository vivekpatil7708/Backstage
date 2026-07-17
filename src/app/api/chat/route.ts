import { NextRequest, NextResponse } from "next/server"
import { chatWithCoach } from "@/lib/chatbot"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message = body.message || ""
    const history = body.history || []
    const context = body.context || {}

    const response = await chatWithCoach(message, history, context)
    return NextResponse.json({ response })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
