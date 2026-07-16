import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Backstest - F&O Strategy Backtesting',
  description: 'Backtest Indian stock and F&O strategies with natural language',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
