"""Tests for the backtesting engine and strategy parser."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from app.core.engine.backtest import BacktestEngine
from app.core.models.strategy import (
    Condition,
    ConditionOperator,
    EntryRule,
    ExitRule,
    InstrumentType,
    RiskManagement,
    Side,
    StrategyDefinition,
    Timeframe,
)
from app.data.synthetic_adapter import SyntheticDataAdapter
from app.strategies.parser import parse_natural_language


@pytest.fixture
def sample_data():
    adapter = SyntheticDataAdapter()
    return adapter.load("NIFTY", "2023-01-01", "2024-06-30", "1d")


@pytest.fixture
def rsi_strategy():
    return StrategyDefinition(
        name="RSI Mean Reversion",
        description="Buy when RSI < 30, exit when RSI > 70",
        timeframe=Timeframe.DAY_1,
        initial_capital=100000,
        entry_rules=[
            EntryRule(
                conditions=[
                    Condition(indicator="rsi", operator=ConditionOperator.LT, value=30, period=14)
                ],
                instrument="NIFTY",
                instrument_type=InstrumentType.INDEX,
                side=Side.BUY,
            )
        ],
        exit_rules=[
            ExitRule(
                conditions=[
                    Condition(indicator="rsi", operator=ConditionOperator.GT, value=70, period=14)
                ]
            )
        ],
        risk_management=RiskManagement(
            stop_loss_percent=2.0,
            take_profit_percent=4.0,
            max_positions=1,
        ),
    )


class TestIndicators:
    def test_rsi(self, sample_data):
        from app.core.indicators.technical import rsi
        result = rsi(sample_data["Close"], 14)
        assert len(result) == len(sample_data)
        assert result.dropna().between(0, 100).all()

    def test_ema(self, sample_data):
        from app.core.indicators.technical import ema
        result = ema(sample_data["Close"], 20)
        assert len(result) == len(sample_data)
        assert not result.dropna().empty

    def test_macd(self, sample_data):
        from app.core.indicators.technical import macd
        result = macd(sample_data["Close"])
        assert "macd" in result.columns
        assert "signal" in result.columns


class TestStrategyParser:
    def test_parse_basic(self):
        strategy = parse_natural_language(
            "Buy NIFTY when RSI(14) < 30. Stop loss 2%, target 4%"
        )
        assert strategy.entry_rules[0].instrument == "NIFTY"
        assert strategy.risk_management.stop_loss_percent == 2.0
        assert strategy.risk_management.take_profit_percent == 4.0

    def test_parse_options(self):
        strategy = parse_natural_language(
            "Buy BANKNIFTY CE when RSI(14) < 30. Intraday"
        )
        assert strategy.entry_rules[0].option_type is not None
        assert strategy.exit_rules[0].exit_at_end_of_day

    def test_parse_trailing_stop(self):
        strategy = parse_natural_language(
            "Buy RELIANCE when EMA(20) crosses above SMA(50). Trailing stop 1.5%"
        )
        assert strategy.risk_management.trailing_stop_percent == 1.5


class TestBacktestEngine:
    def test_basic_backtest(self, rsi_strategy, sample_data):
        engine = BacktestEngine(rsi_strategy, sample_data)
        result = engine.run()
        assert result.initial_capital == 100000
        assert result.total_trades >= 0
        assert result.equity_curve[0].equity == 100000

    def test_max_drawdown(self, rsi_strategy, sample_data):
        engine = BacktestEngine(rsi_strategy, sample_data)
        result = engine.run()
        assert result.max_drawdown_pct >= 0
        assert result.max_drawdown_pct <= 100

    def test_no_trades(self, sample_data):
        strategy = StrategyDefinition(
            name="No trades",
            timeframe=Timeframe.DAY_1,
            initial_capital=100000,
            entry_rules=[
                EntryRule(
                    conditions=[
                        Condition(indicator="rsi", operator=ConditionOperator.LT, value=-1, period=14)
                    ],
                    instrument="NIFTY",
                )
            ],
        )
        engine = BacktestEngine(strategy, sample_data)
        result = engine.run()
        assert result.total_trades == 0
        assert result.final_capital == 100000


class TestMetrics:
    def test_report_format(self, rsi_strategy, sample_data):
        from app.services.metrics import format_report
        engine = BacktestEngine(rsi_strategy, sample_data)
        result = engine.run()
        report = format_report(result)
        assert "BACKTEST REPORT" in report
        assert "INITIAL CAPITAL" in report

    def test_analysis(self, rsi_strategy, sample_data):
        from app.services.metrics import analyze_backtest
        engine = BacktestEngine(rsi_strategy, sample_data)
        result = engine.run()
        insights = analyze_backtest(result)
        assert isinstance(insights, list)
        assert len(insights) > 0


class TestSyntheticData:
    def test_load(self):
        adapter = SyntheticDataAdapter()
        data = adapter.load("NIFTY", "2023-01-01", "2023-12-31")
        assert "Open" in data.columns
        assert "Close" in data.columns
        assert len(data) > 0

    def test_list_instruments(self):
        adapter = SyntheticDataAdapter()
        instruments = adapter.list_instruments()
        assert "NIFTY" in instruments
