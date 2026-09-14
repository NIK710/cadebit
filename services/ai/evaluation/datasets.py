import json
from pathlib import Path

from pydantic import BaseModel

from .models import EvaluationConfig


class DatasetError(ValueError):
    pass


def load_jsonl[DatasetModel: BaseModel](
    path: Path, model: type[DatasetModel]
) -> tuple[str, list[DatasetModel]]:
    records: list[DatasetModel] = []
    versions: set[str] = set()
    identifiers: set[str] = set()
    with path.open(encoding="utf-8") as source:
        for line_number, raw_line in enumerate(source, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                record = model.model_validate_json(line)
            except ValueError as error:
                raise DatasetError(f"{path}:{line_number}: {error}") from error
            record_id = getattr(record, "id", None)
            version = getattr(record, "dataset_version", None)
            if not isinstance(record_id, str) or not isinstance(version, str):
                raise DatasetError(
                    f"{path}:{line_number}: missing id or dataset_version"
                )
            if record_id in identifiers:
                raise DatasetError(f"{path}:{line_number}: duplicate id {record_id}")
            identifiers.add(record_id)
            versions.add(version)
            records.append(record)
    if not records:
        raise DatasetError(f"{path}: dataset is empty")
    if len(versions) != 1:
        raise DatasetError(f"{path}: records must use exactly one dataset_version")
    return versions.pop(), records


def load_corpus[DatasetModel: BaseModel](
    path: Path, model: type[DatasetModel]
) -> list[DatasetModel]:
    records: list[DatasetModel] = []
    identifiers: set[str] = set()
    with path.open(encoding="utf-8") as source:
        for line_number, raw_line in enumerate(source, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                record = model.model_validate_json(line)
            except ValueError as error:
                raise DatasetError(f"{path}:{line_number}: {error}") from error
            record_id = getattr(record, "id", None)
            if record_id in identifiers:
                raise DatasetError(f"{path}:{line_number}: duplicate id {record_id}")
            identifiers.add(record_id)
            records.append(record)
    if not records:
        raise DatasetError(f"{path}: corpus is empty")
    return records


def load_config(path: Path) -> EvaluationConfig:
    try:
        return EvaluationConfig.model_validate_json(path.read_text(encoding="utf-8"))
    except ValueError as error:
        raise DatasetError(f"{path}: {error}") from error


def read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DatasetError(f"Could not read JSON from {path}: {error}") from error
    if not isinstance(value, dict):
        raise DatasetError(f"{path}: expected a JSON object")
    return value
