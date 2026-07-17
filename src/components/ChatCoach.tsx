'use client'

import { useState, useRef, useEffect } from 'react'
import { chat } from '@/lib/api'
import { ChatMessage, BacktestResult, Strategy } from '@/types'

const SUGGESTIONS = [
  'How do I build a momentum strategy for NIFTY?',
  'What stop loss should I use for intraday trades?',
  'How do I backtest a BANKNIFTY straddle?',
  'Explain the impact of slippage on backtest results',
  'How to avoid overfitting in backtesting?',
  'What is the best indicator for options buying?',
]

interface Props {
  result: BacktestResult | null
  strategy: Strategy | null
}

export default function ChatCoach({ result, strategy }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: result
        ? `I see your backtest results for **${result.strategy_name}**. Let me know what you'd like to improve or ask me anything about your strategy.`
        : 'Welcome to the Strategy Coach! I can help you design trading strategies, analyze backtest results, and improve your approach. What would you like to work on?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setInput('')
    setLoading(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const context: any = {}
      if (strategy) context.strategy = strategy
      if (result) {
        const { equity_curve, trades, monthly_returns, ...metrics } = result
        context.result = metrics
      }
      const res = await chat(msg, history, context)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.response }])
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${e.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card flex flex-col h-[70vh]">
      <div ref={scrollRef} className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#11111b] text-gray-200 border border-[#2a2a3a]'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#11111b] border border-[#2a2a3a] rounded-xl px-4 py-3 text-sm text-gray-400">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="bg-[#11111b] hover:bg-gray-700 text-xs text-gray-300 px-3 py-1.5 rounded-full"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask the strategy coach..."
          className="flex-1"
          disabled={loading}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
