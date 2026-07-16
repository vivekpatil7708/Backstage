const API_BASE = '/api'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.detail || 'API error')
  }
  return res.json()
}

export async function parseStrategy(prompt: string) {
  return apiFetch<{ strategy: any; json: string; yaml: string }>(
    `/parse?prompt=${encodeURIComponent(prompt)}`
  )
}

export async function runBacktest(payload: {
  strategy: any
  data_source: string
  instrument: string
  start_date: string
  end_date: string
}) {
  return apiFetch<{ run_id: number; result: any }>('/backtest', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function chat(message: string, history: any[]) {
  return apiFetch<{ response: string }>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  })
}

export async function getIndicators() {
  return apiFetch<{ indicators: string[] }>('/indicators')
}

export async function getDataSources() {
  return apiFetch<{ sources: string[] }>('/data/sources')
}

export async function getInstruments(source: string) {
  return apiFetch<{ instruments: string[] }>(`/data/instruments?source=${source}`)
}
