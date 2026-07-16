from abc import ABC, abstractmethod

import pandas as pd


class DataAdapter(ABC):
    """Base class for all data adapters. Implement load() to plug in new data sources."""

    @abstractmethod
    def load(
        self,
        instrument: str,
        start_date: str,
        end_date: str,
        timeframe: str = "1d",
    ) -> pd.DataFrame:
        """Load OHLCV data for an instrument.

        Returns a DataFrame with columns:
            - datetime (index or column)
            - Open, High, Low, Close, Volume
        """
        ...

    @abstractmethod
    def list_instruments(self) -> list[str]:
        """Return available instruments."""
        ...

    def validate_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        required = {"Open", "High", "Low", "Close"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"DataFrame missing required columns: {missing}")
        if "Volume" not in df.columns:
            df["Volume"] = 0
        if "datetime" in df.columns:
            df["datetime"] = pd.to_datetime(df["datetime"])
            df.set_index("datetime", inplace=True)
        elif not isinstance(df.index, pd.DatetimeIndex):
            raise ValueError("DataFrame must have a 'datetime' column or DatetimeIndex")
        df.sort_index(inplace=True)
        return df
