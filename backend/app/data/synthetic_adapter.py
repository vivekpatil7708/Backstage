import numpy as np
import pandas as pd

from .base import DataAdapter


class SyntheticDataAdapter(DataAdapter):
    """Generate synthetic data for testing and demo purposes.

    Creates realistic-looking OHLCV data with configurable parameters.
    """

    def __init__(self):
        self._instruments = [
            "NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY",
            "HDFCBANK", "ICICIBANK", "SBIN", "ITC", "TATAMOTORS",
        ]

    def load(
        self,
        instrument: str,
        start_date: str,
        end_date: str,
        timeframe: str = "1d",
    ) -> pd.DataFrame:
        np.random.seed(hash(instrument) % 2**31)

        dates = pd.date_range(start=start_date, end=end_date, freq="B")
        n = len(dates)

        base_prices = {
            "NIFTY": 18000, "BANKNIFTY": 40000, "RELIANCE": 2500,
            "TCS": 3500, "INFY": 1500, "HDFCBANK": 1600,
            "ICICIBANK": 900, "SBIN": 600, "ITC": 450, "TATAMOTORS": 600,
        }
        base = base_prices.get(instrument, 1000)

        drift = 0.0003
        volatility = 0.015
        returns = np.random.normal(drift, volatility, n)
        close = base * np.exp(np.cumsum(returns))

        daily_range = close * np.random.uniform(0.005, 0.025, n)
        high = close + daily_range * np.random.uniform(0.3, 0.8, n)
        low = close - daily_range * np.random.uniform(0.3, 0.8, n)
        open_price = low + (high - low) * np.random.uniform(0.2, 0.8, n)

        volume = np.random.randint(100000, 5000000, n)

        df = pd.DataFrame({
            "Open": open_price,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": volume,
        }, index=dates)
        df.index.name = "datetime"

        return df

    def list_instruments(self) -> list[str]:
        return self._instruments.copy()
