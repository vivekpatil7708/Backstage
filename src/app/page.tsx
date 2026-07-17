'use client'

import { useState } from 'react'
import StrategyBuilder from '@/components/StrategyBuilder'
import BacktestResults from '@/components/BacktestResults'
import ChatCoach from '@/components/ChatCoach'
import { BacktestResult, Strategy } from '@/types'

type Tab = 'builder' | 'results' | 'chat'

export default function Home() {
  const [tab, setTab] = useState<Tab>('builder')
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [strategy, setStrategy] = useState<Strategy | null>(null)

  const tabs: [Tab, string][] = [
    ['builder', 'Strategy Builder'],
    ['results', 'Results'],
    ['chat', 'AI Coach'],
  ]

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#2a2a3a] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-500">Backstest</h1>
          <p className="text-sm text-gray-400">
            Backtest F&O &amp; stock strategies with no-code
          </p>
        </div>
      </header>

      <nav className="border-b border-[#2a2a3a] px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 rounded-none ${
                tab === key
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'builder' && (
          <StrategyBuilder
            onBacktestComplete={(r, s) => {
              setResult(r)
              setStrategy(s)
              setTab('results')
            }}
          />
        )}
        {tab === 'results' && <BacktestResults result={result} />}
        {tab === 'chat' && <ChatCoach result={result} strategy={strategy} />}
      </main>
    </div>
  )
}
