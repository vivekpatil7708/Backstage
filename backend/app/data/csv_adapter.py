from pathlib import Path

import pandas as pd

from .base import DataAdapter


class CSVDataAdapter(DataAdapter):
    """Load data from CSV files.

    Expects CSV format with columns:
        datetime, Open, High, Low, Close, Volume

    Files can be named as {instrument}_{timeframe}.csv or placed in subdirectories.
    """

    def __init__(self, base_path: str | Path = "."):
        self.base_path = Path(base_path)

    def load(
        self,
        instrument: str,
        start_date: str,
        end_date: str,
        timeframe: str = "1d",
    ) -> pd.DataFrame:
        candidates = [
            self.base_path / f"{instrument}.csv",
            self.base_path / f"{instrument}_{timeframe}.csv",
            self.base_path / instrument / f"{timeframe}.csv",
            self.base_path / f"{instrument}.csv",
        ]

        for path in candidates:
            if path.exists():
                df = pd.read_csv(path)
                df = self.validate_columns(df)
                mask = (df.index >= pd.Timestamp(start_date)) & (
                    df.index <= pd.Timestamp(end_date)
                )
                return df.loc[mask]

        raise FileNotFoundError(
            f"No data file found for {instrument}. Tried: {[str(c) for c in candidates]}"
        )

    def list_instruments(self) -> list[str]:
        instruments = set()
        for f in self.base_path.glob("*.csv"):
            instruments.add(f.stem)
        for d in self.base_path.iterdir():
            if d.is_dir():
                for f in d.glob("*.csv"):
                    instruments.add(f"{d.name}/{f.stem}")
        return sorted(instruments)
