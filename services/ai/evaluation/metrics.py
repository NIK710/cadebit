from dataclasses import dataclass


@dataclass(frozen=True)
class RetrievalMetrics:
    recall_at_k: float
    precision_at_k: float
    reciprocal_rank: float


def calculate_retrieval_metrics(
    retrieved_ids: list[str], relevant_ids: list[str], k: int
) -> RetrievalMetrics:
    if k < 1:
        raise ValueError("k must be positive")
    relevant = set(relevant_ids)
    if not relevant:
        raise ValueError("relevant_ids cannot be empty")
    ranked = retrieved_ids[:k]
    relevant_retrieved = len(relevant.intersection(ranked))
    first_rank = next(
        (
            index
            for index, identifier in enumerate(ranked, start=1)
            if identifier in relevant
        ),
        None,
    )
    return RetrievalMetrics(
        recall_at_k=relevant_retrieved / len(relevant),
        precision_at_k=relevant_retrieved / k,
        reciprocal_rank=0 if first_rank is None else 1 / first_rank,
    )


def macro_average(case_metrics: list[RetrievalMetrics]) -> dict[str, float]:
    if not case_metrics:
        raise ValueError("case_metrics cannot be empty")
    count = len(case_metrics)
    return {
        "retrieval_recall_at_k": round(
            sum(item.recall_at_k for item in case_metrics) / count, 6
        ),
        "retrieval_precision_at_k": round(
            sum(item.precision_at_k for item in case_metrics) / count, 6
        ),
        "retrieval_mrr": round(
            sum(item.reciprocal_rank for item in case_metrics) / count, 6
        ),
    }
