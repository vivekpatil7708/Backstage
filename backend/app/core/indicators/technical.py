from typing import Optional

import numpy as np
import pandas as pd


def sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period, min_periods=period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def macd(
    series: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> pd.DataFrame:
    ema_fast = ema(series, fast)
    ema_slow = ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return pd.DataFrame(
        {"macd": macd_line, "signal": signal_line, "histogram": histogram}
    )


def bollinger_bands(
    series: pd.Series, period: int = 20, std_dev: float = 2.0
) -> pd.DataFrame:
    mid = sma(series, period)
    rolling_std = series.rolling(window=period, min_periods=period).std()
    upper = mid + std_dev * rolling_std
    lower = mid - std_dev * rolling_std
    return pd.DataFrame({"upper": upper, "mid": mid, "lower": lower})


def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return true_range.ewm(alpha=1 / period, min_periods=period).mean()


def stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k_period: int = 14,
    d_period: int = 3,
) -> pd.DataFrame:
    lowest_low = low.rolling(window=k_period, min_periods=k_period).min()
    highest_high = high.rolling(window=k_period, min_periods=k_period).max()
    k = 100 * (close - lowest_low) / (highest_high - lowest_low).replace(0, np.nan)
    d = sma(k, d_period)
    return pd.DataFrame({"k": k, "d": d})


def vwap(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    volume: pd.Series,
) -> pd.Series:
    typical_price = (high + low + close) / 3
    cumulative_tpv = (typical_price * volume).cumsum()
    cumulative_vol = volume.cumsum()
    return cumulative_tpv / cumulative_vol.replace(0, np.nan)


def supertrend(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 10,
    multiplier: float = 3.0,
) -> pd.DataFrame:
    atr_val = atr(high, low, close, period)
    hl2 = (high + low) / 2
    upper_band = hl2 + multiplier * atr_val
    lower_band = hl2 - multiplier * atr_val

    supertrend_val = pd.Series(np.nan, index=close.index)
    direction = pd.Series(1, index=close.index)

    for i in range(1, len(close)):
        if close.iloc[i] > upper_band.iloc[i - 1]:
            direction.iloc[i] = 1
        elif close.iloc[i] < lower_band.iloc[i - 1]:
            direction.iloc[i] = -1
        else:
            direction.iloc[i] = direction.iloc[i - 1]
            if direction.iloc[i] == 1 and lower_band.iloc[i] < lower_band.iloc[i - 1]:
                lower_band.iloc[i] = lower_band.iloc[i - 1]
            if direction.iloc[i] == -1 and upper_band.iloc[i] > upper_band.iloc[i - 1]:
                upper_band.iloc[i] = upper_band.iloc[i - 1]

        supertrend_val.iloc[i] = lower_band.iloc[i] if direction.iloc[i] == 1 else upper_band.iloc[i]

    return pd.DataFrame({"supertrend": supertrend_val, "direction": direction})


def adx(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.Series:
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0.0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0.0)
    atr_val = atr(high, low, close, period)
    plus_di = 100 * ema(plus_dm, period) / atr_val.replace(0, np.nan)
    minus_di = 100 * ema(minus_dm, period) / atr_val.replace(0, np.nan)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return ema(dx, period)


INDICATOR_REGISTRY: dict[str, callable] = {
    "sma": sma,
    "ema": ema,
    "rsi": rsi,
    "macd": macd,
    "bollinger_bands": bollinger_bands,
    "atr": atr,
    "stochastic": stochastic,
    "vwap": vwap,
    "supertrend": supertrend,
    "adx": adx,
}


def compute_indicator(
    name: str, data: pd.DataFrame, params: Optional[dict] = None
) -> pd.Series | pd.DataFrame:
    if name not in INDICATOR_REGISTRY:
        raise ValueError(f"Unknown indicator: {name}. Available: {list(INDICATOR_REGISTRY.keys())}")

    func = INDICATOR_REGISTRY[name]
    params = params or {}

    col_map = {
        "close": "Close",
        "open": "Open",
        "high": "High",
        "low": "Low",
        "volume": "Volume",
    }

    if name in ("sma", "ema", "rsi"):
        period = params.get("period", params.get("length", 14))
        return func(data[col_map.get("close", "Close")], period=period)
    elif name == "macd":
        return func(
            data[col_map.get("close", "Close")],
            fast=params.get("fast", 12),
            slow=params.get("slow", 26),
            signal=params.get("signal", 9),
        )
    elif name == "bollinger_bands":
        return func(
            data[col_map.get("close", "Close")],
            period=params.get("period", 20),
            std_dev=params.get("std_dev", 2.0),
        )
    elif name == "atr":
        return func(
            data[col_map["high"]], data[col_map["low"]], data[col_map["close"]],
            period=params.get("period", 14),
        )
    elif name == "stochastic":
        return func(
            data[col_map["high"]], data[col_map["low"]], data[col_map["close"]],
            k_period=params.get("k_period", 14),
            d_period=params.get("d_period", 3),
        )
    elif name == "vwap":
        return func(
            data[col_map["high"]], data[col_map["low"]],
            data[col_map["close"]], data[col_map["volume"]],
        )
    elif name == "supertrend":
        return func(
            data[col_map["high"]], data[col_map["low"]], data[col_map["close"]],
            period=params.get("period", 10),
            multiplier=params.get("multiplier", 3.0),
        )
    elif name == "adx":
        return func(
            data[col_map["high"]], data[col_map["low"]], data[col_map["close"]],
            period=params.get("period", 14),
        )
    else:
        return func(data[col_map.get("close", "Close")], **params)
