import json
import re
from typing import Optional

from ..core.models.strategy import (
    Condition,
    ConditionOperator,
    EntryRule,
    ExitRule,
    InstrumentType,
    OptionType,
    RiskManagement,
    Side,
    StrategyDefinition,
    Timeframe,
)


def parse_natural_language(prompt: str) -> StrategyDefinition:
    """Parse a natural language strategy description into a StrategyDefinition.

    Supports patterns like:
    - "Buy NIFTY when RSI(14) < 30 and price crosses above EMA(20)"
    - "Sell BANKNIFTY PE when RSI > 70. Stop loss 1%, target 2%"
    - "Intraday, buy RELIANCE when MACD crosses above signal"
    """
    prompt_lower = prompt.lower()

    instrument = _extract_instrument(prompt_lower)
    side = _extract_side(prompt_lower)
    option_type = _extract_option_type(prompt_lower)
    timeframe = _extract_timeframe(prompt_lower)
    conditions = _extract_conditions(prompt)
    risk_mgmt = _extract_risk_management(prompt_lower)
    exit_rules = _extract_exit_rules(prompt_lower)

    instrument_type = InstrumentType.EQUITY
    if instrument in ("nifty", "banknifty", "nifty50"):
        instrument_type = InstrumentType.INDEX
    if option_type:
        instrument_type = InstrumentType.OPTIONS_CE if option_type == OptionType.CALL else InstrumentType.OPTIONS_PE

    entry = EntryRule(
        conditions=conditions if conditions else [
            Condition(indicator="sma", operator=ConditionOperator.CROSS_ABOVE, value=20, period=20)
        ],
        instrument=instrument.upper(),
        instrument_type=instrument_type,
        side=side,
        option_type=option_type,
    )

    if "intraday" in prompt_lower or "intra day" in prompt_lower:
        exit_rules.append(ExitRule(exit_at_end_of_day=True))
    if not exit_rules:
        exit_rules.append(ExitRule())

    return StrategyDefinition(
        name=f"NL Strategy - {instrument.upper()}",
        description=prompt,
        timeframe=timeframe,
        entry_rules=[entry],
        exit_rules=exit_rules,
        risk_management=risk_mgmt,
    )


def _extract_instrument(prompt: str) -> str:
    known = ["banknifty", "nifty50", "nifty", "reliance", "tcs", "infy",
             "hdfcbank", "icicibank", "sbin", "itc", "tatamotors"]
    for inst in known:
        if inst in prompt:
            return inst
    match = re.search(r"(?:buy|sell|entry)\s+(\w+)", prompt)
    return match.group(1) if match else "NIFTY"


def _extract_side(prompt: str) -> Side:
    if re.search(r"\b(short|sell)\b", prompt):
        return Side.SELL
    return Side.BUY


def _extract_option_type(prompt: str) -> Optional[OptionType]:
    if re.search(r"\b(ce|call)\b", prompt):
        return OptionType.CALL
    if re.search(r"\b(pe|put)\b", prompt):
        return OptionType.PUT
    return None


def _extract_timeframe(prompt: str) -> Timeframe:
    if re.search(r"\b(1\s*min|1m)\b", prompt):
        return Timeframe.MIN_1
    if re.search(r"\b(5\s*min|5m)\b", prompt):
        return Timeframe.MIN_5
    if re.search(r"\b(15\s*min|15m)\b", prompt):
        return Timeframe.MIN_15
    if re.search(r"\b(30\s*min|30m)\b", prompt):
        return Timeframe.MIN_30
    if re.search(r"\b(1\s*h|hourly|1h)\b", prompt):
        return Timeframe.HOUR_1
    if re.search(r"\b(weekly|1w)\b", prompt):
        return Timeframe.WEEK_1
    return Timeframe.DAY_1


def _extract_conditions(prompt: str) -> list[Condition]:
    conditions = []
    rsi_match = re.search(
        r"rsi\s*\(\s*(\d+)\s*\)\s*([<>=!]+)\s*(\d+)", prompt, re.IGNORECASE
    )
    if rsi_match:
        period, op, val = int(rsi_match.group(1)), rsi_match.group(2), float(rsi_match.group(3))
        conditions.append(Condition(indicator="rsi", operator=_map_operator(op), value=val, period=period))

    ema_cross = re.search(
        r"(?:crosses?\s+(?:above|over))\s+(?:the\s+)?(?:\d+\s*)?ema\s*\(\s*(\d+)\s*\)",
        prompt, re.IGNORECASE,
    )
    if ema_cross:
        period = int(ema_cross.group(1))
        conditions.append(Condition(indicator="ema", operator=ConditionOperator.CROSS_ABOVE, value=0, period=period))

    ema_cross_below = re.search(
        r"(?:crosses?\s+(?:below|under))\s+(?:the\s+)?(?:\d+\s*)?ema\s*\(\s*(\d+)\s*\)",
        prompt, re.IGNORECASE,
    )
    if ema_cross_below:
        period = int(ema_cross_below.group(1))
        conditions.append(Condition(indicator="ema", operator=ConditionOperator.CROSS_BELOW, value=0, period=period))

    sma_match = re.search(
        r"sma\s*\(\s*(\d+)\s*\)\s*([<>=]+)\s*(\d+)", prompt, re.IGNORECASE
    )
    if sma_match:
        period, op, val = int(sma_match.group(1)), sma_match.group(2), float(sma_match.group(3))
        conditions.append(Condition(indicator="sma", operator=_map_operator(op), value=val, period=period))

    macd_match = re.search(r"macd\s+(?:crosses?\s+above|>\s*signal)", prompt, re.IGNORECASE)
    if macd_match:
        conditions.append(Condition(indicator="macd", operator=ConditionOperator.CROSS_ABOVE, value=0))

    adx_match = re.search(r"adx\s*\(\s*(\d+)\s*\)\s*([<>=]+)\s*(\d+)", prompt, re.IGNORECASE)
    if adx_match:
        period, op, val = int(adx_match.group(1)), adx_match.group(2), float(adx_match.group(3))
        conditions.append(Condition(indicator="adx", operator=_map_operator(op), value=val, period=period))

    if not conditions:
        conditions.append(Condition(indicator="sma", operator=ConditionOperator.CROSS_ABOVE, value=20, period=20))

    return conditions


def _map_operator(op: str) -> ConditionOperator:
    op = op.strip()
    if op in (">>", ">"):
        return ConditionOperator.GT
    if op in ("<<", "<"):
        return ConditionOperator.LT
    if op == ">=":
        return ConditionOperator.GTE
    if op == "<=":
        return ConditionOperator.LTE
    if op == "==":
        return ConditionOperator.EQ
    if op == "!=":
        return ConditionOperator.NEQ
    return ConditionOperator.GT


def _extract_risk_management(prompt: str) -> RiskManagement:
    sl = None
    tp = None
    trailing = None

    sl_match = re.search(r"stop\s*loss\s*(\d+\.?\d*)\s*%", prompt, re.IGNORECASE)
    if sl_match:
        sl = float(sl_match.group(1))

    tp_match = re.search(r"target\s*(\d+\.?\d*)\s*%", prompt, re.IGNORECASE)
    if tp_match:
        tp = float(tp_match.group(1))

    trail_match = re.search(r"trailing\s*(?:stop)?\s*(\d+\.?\d*)\s*%", prompt, re.IGNORECASE)
    if trail_match:
        trailing = float(trail_match.group(1))

    max_loss_match = re.search(r"max\s*(?:loss|drawdown)\s*(?:per\s*day\s*)?(\d+)", prompt, re.IGNORECASE)
    max_loss = float(max_loss_match.group(1)) if max_loss_match else None

    max_pos_match = re.search(r"max\s*positions?\s*(\d+)", prompt, re.IGNORECASE)
    max_pos = int(max_pos_match.group(1)) if max_pos_match else 1

    return RiskManagement(
        stop_loss_percent=sl,
        take_profit_percent=tp,
        trailing_stop_percent=trailing,
        max_loss_per_day=max_loss,
        max_positions=max_pos,
    )


def _extract_exit_rules(prompt: str) -> list[ExitRule]:
    rules = []
    if "intraday" in prompt or "intra day" in prompt or "eod" in prompt:
        rules.append(ExitRule(exit_at_end_of_day=True))
    if "swing" in prompt:
        rules.append(ExitRule(max_bars_in_trade=20))
    return rules


def strategy_to_json(strategy: StrategyDefinition) -> str:
    return strategy.model_dump_json(indent=2)


def strategy_from_json(json_str: str) -> StrategyDefinition:
    data = json.loads(json_str)
    return StrategyDefinition(**data)


def strategy_to_yaml(strategy: StrategyDefinition) -> str:
    import yaml
    return yaml.dump(strategy.model_dump(), default_flow_style=False, sort_keys=False)


def strategy_from_yaml(yaml_str: str) -> StrategyDefinition:
    import yaml
    data = yaml.safe_load(yaml_str)
    return StrategyDefinition(**data)
