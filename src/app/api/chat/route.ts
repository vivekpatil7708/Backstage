import { NextRequest, NextResponse } from "next/server"
import { chatWithCoach } from "@/lib/chatbot"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message = body.message || ""
    const history = body.history || []

    const response = await chatWithCoach(message, history)
    return NextResponse.json({ response })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
