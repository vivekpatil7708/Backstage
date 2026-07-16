"""Generate sample CSV data files for NSE instruments."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))


def generate(instrument: str, base_price: float, days: int, output_dir: Path):
    np.random.seed(hash(instrument) % 2**31)
    dates = pd.date_range("2022-01-03", periods=days, freq="B")

    drift = 0.0002
    volatility = 0.018
    returns = np.random.normal(drift, volatility, days)
    close = base_price * np.exp(np.cumsum(returns))

    daily_range = close * np.random.uniform(0.005, 0.025, days)
    high = close + daily_range * np.random.uniform(0.3, 0.8, days)
    low = close - daily_range * np.random.uniform(0.3, 0.8, days)
    open_price = low + (high - low) * np.random.uniform(0.2, 0.8, days)
    volume = np.random.randint(100000, 5000000, days)

    df = pd.DataFrame({
        "datetime": dates,
        "Open": open_price.round(2),
        "High": high.round(2),
        "Low": low.round(2),
        "Close": close.round(2),
        "Volume": volume,
    })

    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{instrument}.csv"
    df.to_csv(path, index=False)
    print(f"Generated {path} ({len(df)} rows)")


if __name__ == "__main__":
    out = Path(__file__).parent
    instruments = {
        "NIFTY": (18000, 500),
        "BANKNIFTY": (40000, 500),
        "RELIANCE": (2500, 500),
        "TCS": (3500, 500),
        "INFY": (1500, 500),
        "HDFCBANK": (1600, 500),
    }
    for name, (price, days) in instruments.items():
        generate(name, price, days, out)
    print("Done!")
