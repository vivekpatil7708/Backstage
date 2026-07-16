'use client'

import { Trade } from '@/types'

interface Props {
  trades: Trade[]
}

export default function TradeTable({ trades }: Props) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[#1e1e2e]">
          <tr className="text-left text-gray-400 text-xs">
            <th className="p-2">#</th>
            <th className="p-2">Instrument</th>
            <th className="p-2">Side</th>
            <th className="p-2">Entry Date</th>
            <th className="p-2">Entry Price</th>
            <th className="p-2">Exit Date</th>
            <th className="p-2">Exit Price</th>
            <th className="p-2">P&amp;L</th>
            <th className="p-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-t border-[#2a2a3a] hover:bg-[#11111b]">
              <td className="p-2 text-gray-500">{i + 1}</td>
              <td className="p-2 font-medium">{t.entry_order.instrument}</td>
              <td className="p-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    t.entry_order.side === 'buy'
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-red-900/30 text-red-400'
                  }`}
                >
                  {t.entry_order.side.toUpperCase()}
                </span>
              </td>
              <td className="p-2 text-gray-400">{fmtDate(t.entry_order.timestamp)}</td>
              <td className="p-2">{`\u20B9${t.entry_order.price.toFixed(2)}`}</td>
              <td className="p-2 text-gray-400">{fmtDate(t.exit_order.timestamp)}</td>
              <td className="p-2">{`\u20B9${t.exit_order.price.toFixed(2)}`}</td>
              <td
                className={`p-2 font-medium ${
                  t.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {`\u20B9${t.net_pnl.toFixed(2)}`}
              </td>
              <td className="p-2 text-gray-500 text-xs">{t.exit_reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function fmtDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })
  } catch {
    return ts
  }
}
