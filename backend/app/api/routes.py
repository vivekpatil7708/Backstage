import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..core.engine.backtest import BacktestEngine
from ..core.models.strategy import StrategyDefinition
from ..data.registry import get_adapter
from ..db.database import BacktestRunDB, StrategyDB, async_session
from ..strategies.parser import (
    parse_natural_language,
    strategy_to_json,
    strategy_to_yaml,
)

router = APIRouter()


@router.post("/strategies", summary="Create a strategy")
async def create_strategy(strategy: StrategyDefinition):
    async with async_session() as session:
        db = StrategyDB(
            name=strategy.name,
            description=strategy.description,
            definition_json=strategy.model_dump_json(),
            created_at=datetime.utcnow(),
        )
        session.add(db)
        await session.commit()
        await session.refresh(db)
        return {
            "id": db.id,
            "name": db.name,
            "definition": strategy.model_dump(),
            "created_at": str(db.created_at),
        }


@router.get("/strategies", summary="List all strategies")
async def list_strategies():
    async with async_session() as session:
        result = await session.execute(select(StrategyDB).order_by(StrategyDB.created_at.desc()))
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "created_at": str(r.created_at),
            }
            for r in rows
        ]


@router.get("/strategies/{strategy_id}", summary="Get a strategy")
async def get_strategy(strategy_id: int):
    async with async_session() as session:
        result = await session.execute(select(StrategyDB).where(StrategyDB.id == strategy_id))
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(404, "Strategy not found")
        return {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "definition": json.loads(row.definition_json),
            "created_at": str(row.created_at),
        }


@router.delete("/strategies/{strategy_id}", summary="Delete a strategy")
async def delete_strategy(strategy_id: int):
    async with async_session() as session:
        result = await session.execute(select(StrategyDB).where(StrategyDB.id == strategy_id))
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(404, "Strategy not found")
        await session.delete(row)
        await session.commit()
        return {"deleted": True}


@router.post("/strategies/parse", summary="Parse natural language to strategy")
async def parse_strategy(prompt: str):
    strategy = parse_natural_language(prompt)
    return {
        "strategy": strategy.model_dump(),
        "json": strategy_to_json(strategy),
        "yaml": strategy_to_yaml(strategy),
    }


@router.post("/backtest", summary="Run a backtest")
async def run_backtest(request: dict):
    strategy_def = StrategyDefinition(**request.get("strategy", {}))
    data_source = request.get("data_source", "synthetic")
    instrument = request.get("instrument", "NIFTY")
    start_date = request.get("start_date", "2023-01-01")
    end_date = request.get("end_date", "2024-12-31")

    adapter = get_adapter(data_source)
    data = adapter.load(instrument, start_date, end_date, strategy_def.timeframe.value)

    engine = BacktestEngine(strategy_def, data)
    result = engine.run()

    async with async_session() as session:
        run = BacktestRunDB(
            strategy_id=0,
            status="completed",
            result_json=result.model_dump_json(),
            data_source=data_source,
            completed_at=datetime.utcnow(),
        )
        session.add(run)
        await session.commit()
        await session.refresh(run)

    return {
        "run_id": run.id,
        "result": result.model_dump(),
    }


@router.get("/backtest/{run_id}", summary="Get backtest results")
async def get_backtest(run_id: int):
    async with async_session() as session:
        result = await session.execute(
            select(BacktestRunDB).where(BacktestRunDB.id == run_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(404, "Backtest run not found")
        return {
            "id": row.id,
            "status": row.status,
            "result": json.loads(row.result_json) if row.result_json else None,
            "created_at": str(row.created_at),
        }


@router.get("/data/sources", summary="List available data sources")
async def list_data_sources():
    from ..data.registry import ADAPTER_REGISTRY
    return {"sources": list(ADAPTER_REGISTRY.keys())}


@router.get("/data/instruments/{source}", summary="List instruments for a source")
async def list_instruments(source: str):
    adapter = get_adapter(source)
    return {"instruments": adapter.list_instruments()}


@router.post("/data/upload", summary="Upload CSV data")
async def upload_data(file: str, instrument_name: str):
    """Upload CSV data as a base64-encoded string or file path."""
    import base64
    import tempfile
    from pathlib import Path

    try:
        decoded = base64.b64decode(file)
        tmp = Path(tempfile.gettempdir()) / f"{instrument_name}.csv"
        tmp.write_bytes(decoded)
    except Exception:
        tmp = Path(file)
        if not tmp.exists():
            raise HTTPException(400, "Invalid data. Provide base64-encoded CSV or valid file path.")

    return {"status": "uploaded", "path": str(tmp), "instrument": instrument_name}


@router.get("/indicators", summary="List available indicators")
async def list_indicators():
    from ..core.indicators.technical import INDICATOR_REGISTRY
    return {"indicators": list(INDICATOR_REGISTRY.keys())}


@router.post("/export/strategy/json", summary="Export strategy as JSON")
async def export_json(strategy: StrategyDefinition):
    return {"json": strategy_to_json(strategy)}


@router.post("/export/strategy/yaml", summary="Export strategy as YAML")
async def export_yaml(strategy: StrategyDefinition):
    return {"yaml": strategy_to_yaml(strategy)}
