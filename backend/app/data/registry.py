from .base import DataAdapter
from .csv_adapter import CSVDataAdapter
from .synthetic_adapter import SyntheticDataAdapter

ADAPTER_REGISTRY: dict[str, type[DataAdapter]] = {
    "csv": CSVDataAdapter,
    "synthetic": SyntheticDataAdapter,
}


def get_adapter(source: str, **kwargs) -> DataAdapter:
    if source not in ADAPTER_REGISTRY:
        raise ValueError(
            f"Unknown data source: {source}. Available: {list(ADAPTER_REGISTRY.keys())}"
        )
    return ADAPTER_REGISTRY[source](**kwargs)


def register_adapter(name: str, adapter_class: type[DataAdapter]):
    ADAPTER_REGISTRY[name] = adapter_class
