# Backstest

Backtest F&O and stock strategies for Indian markets using natural language or a no-code form builder. Deployed on Vercel.

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Vercel auto-detects Next.js (frontend) + Python (API)
4. Click Deploy — done

```bash
# Or use Vercel CLI
npx vercel --prod
```

## Features

- **Natural Language** — describe your strategy in plain English
- **No-Code Builder** — form with indicator dropdowns, conditions, SL/TP
- **Backtesting Engine** — slippage, STT, brokerage, exchange charges
- **Performance Metrics** — CAGR, Sharpe, Sortino, drawdown, win rate, profit factor
- **Equity Curve** — interactive charts with drawdown overlay
- **AI Coach** — chatbot that helps design and improve strategies
- **CSV Export** — download equity curve and trade list

## Architecture

```
backstest/
├── api/                    # Python serverless functions (Vercel)
│   ├── backtest.py         # POST /api/backtest
│   ├── parse.py            # GET  /api/parse
│   ├── chat.py             # POST /api/chat
│   ├── indicators.py       # GET  /api/indicators
│   └── data.py             # GET  /api/data
├── backend/                # Python backtesting engine
│   └── app/
│       ├── core/
│       │   ├── models/     # Strategy schema, results
│       │   ├── indicators/ # RSI, EMA, MACD, BB, ATR, VWAP, Supertrend, ADX
│       │   └── engine/     # Bar-by-bar backtest engine
│       ├── data/           # Pluggable data adapters
│       ├── strategies/     # NL → strategy parser
│       └── services/       # Metrics, AI coach
├── src/                    # Next.js frontend (App Router)
│   ├── app/                # Pages + layout
│   └── components/         # StrategyBuilder, Results, Charts, Chat
├── vercel.json             # Vercel config
└── requirements.txt        # Python deps for serverless
```

## Local Development

```bash
# Install deps
npm install
pip install -r requirements.txt

# Run frontend (Next.js)
npm run dev

# Or run everything via Vercel CLI
npx vercel dev
```

Frontend: http://localhost:3000
API: http://localhost:3000/api/*

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backtest` | Run a backtest |
| GET | `/api/parse?prompt=...` | Parse NL to strategy |
| POST | `/api/chat` | Chat with AI coach |
| GET | `/api/indicators` | List indicators |
| GET | `/api/data` | List data sources |
| GET | `/api/data?source=synthetic` | List instruments |

## Example Backtest

```bash
curl -X POST https://your-app.vercel.app/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": {
      "name": "RSI Mean Reversion",
      "timeframe": "1d",
      "initial_capital": 100000,
      "entry_rules": [{
        "conditions": [{"indicator": "rsi", "operator": "<", "value": 30, "period": 14}],
        "instrument": "NIFTY",
        "instrument_type": "index",
        "side": "buy"
      }],
      "exit_rules": [{"conditions": [{"indicator": "rsi", "operator": ">", "value": 70, "period": 14}], "exit_at_end_of_day": false}],
      "risk_management": {"stop_loss_percent": 2, "take_profit_percent": 4, "max_positions": 1},
      "position_sizing": {"sizing_type": "fixed_capital", "lot_size": 1, "capital_per_trade": 50000},
      "transaction_costs": {"brokerage_per_order": 20, "stt_percent": 0.05, "slippage_ticks": 1, "slippage_value": 0.05}
    },
    "data_source": "synthetic",
    "instrument": "NIFTY",
    "start_date": "2023-01-01",
    "end_date": "2024-06-30"
  }'
```

## Extending

### Add an indicator

```python
# backend/app/core/indicators/technical.py
def my_indicator(series, period=14):
    return series.rolling(window=period).std()

INDICATOR_REGISTRY["my_indicator"] = my_indicator
```

### Add a data provider

```python
# backend/app/data/my_adapter.py
from .base import DataAdapter

class ZerodhaAdapter(DataAdapter):
    def load(self, instrument, start_date, end_date, timeframe="1d"):
        # Fetch from Zerodha API
        ...
    def list_instruments(self):
        return ["RELIANCE", "TCS"]

# Register in registry.py
from .registry import register_adapter
register_adapter("zerodha", ZerodhaAdapter)
```

## Testing

```bash
python -m pytest backend/tests/ -v
python -m ruff check backend/ api/
```

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Recharts
- **Backend**: Python 3.11, pandas, numpy
- **Hosting**: Vercel (serverless)
- **AI**: OpenAI API (optional)
