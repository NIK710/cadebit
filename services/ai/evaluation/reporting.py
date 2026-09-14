import json
import platform
import subprocess
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from .models import EvaluationConfig

LOWER_IS_BETTER = {"grading_max_score_spread"}


@dataclass
class TokenCounter:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0

    def add(self, usage: Any) -> None:
        if usage is None:
            return
        self.input_tokens += int(usage.input_tokens)
        self.output_tokens += int(usage.output_tokens)
        self.total_tokens += int(usage.total_tokens)

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


def git_provenance(repository_root: Path) -> dict[str, str | bool | None]:
    try:
        commit = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repository_root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        dirty = bool(
            subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=repository_root,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
        )
    except (OSError, subprocess.CalledProcessError):
        return {"git_commit": None, "git_dirty": None}
    return {"git_commit": commit, "git_dirty": dirty}


def build_report(
    *,
    suite: str,
    started_at: datetime,
    provenance: dict[str, Any],
    cases: list[dict[str, Any]],
    aggregates: dict[str, float],
    token_usage: dict[str, int],
    regression: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schema_version": "evaluation-report-v1",
        "run_id": str(uuid4()),
        "suite": suite,
        "started_at": started_at.astimezone(UTC).isoformat(),
        "finished_at": datetime.now(UTC).isoformat(),
        "provenance": {
            **provenance,
            "python_version": platform.python_version(),
        },
        "token_usage": token_usage,
        "aggregates": aggregates,
        "regression": regression,
        "cases": cases,
    }


def evaluate_regression(
    aggregates: dict[str, float],
    config: EvaluationConfig,
    baseline: dict[str, Any] | None,
) -> dict[str, Any]:
    failures: list[str] = []
    thresholds = config.thresholds.model_dump()
    for metric, value in aggregates.items():
        threshold = thresholds.get(metric)
        if threshold is None:
            continue
        if metric in LOWER_IS_BETTER:
            if value > threshold:
                failures.append(
                    f"{metric}={value:.6f} exceeds threshold {threshold:.6f}"
                )
        elif value < threshold:
            failures.append(f"{metric}={value:.6f} is below threshold {threshold:.6f}")

    baseline_aggregates = baseline.get("aggregates", {}) if baseline else {}
    tolerance = config.baseline_regression_tolerance
    if isinstance(baseline_aggregates, dict):
        for metric, baseline_value in baseline_aggregates.items():
            if metric not in aggregates or not isinstance(baseline_value, (int, float)):
                continue
            value = aggregates[metric]
            if metric in LOWER_IS_BETTER:
                if value > float(baseline_value) + tolerance:
                    failures.append(
                        f"{metric} regressed from {baseline_value:.6f} to {value:.6f}"
                    )
            elif value < float(baseline_value) - tolerance:
                failures.append(
                    f"{metric} regressed from {baseline_value:.6f} to {value:.6f}"
                )
    return {
        "passed": not failures,
        "failures": failures,
        "baseline_schema_version": baseline.get("schema_version") if baseline else None,
        "tolerance": tolerance,
    }


def write_report(report: dict[str, Any], output: Path) -> Path:
    target = output
    if output.suffix.lower() != ".json":
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        target = output / f"{report['suite']}-{timestamp}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(f"{target.suffix}.tmp")
    temporary.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    temporary.replace(target)
    return target
