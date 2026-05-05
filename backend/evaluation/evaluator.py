"""Orchestrator that runs retrieval models against ground truth and
produces per-query + global evaluation reports.

The Evaluator is model-agnostic: it accepts any callable that takes a
query string and returns a list of result dicts with a ``doc_id`` key.
This makes it trivially extensible to BM25, Language Models, etc.
"""

from __future__ import annotations

from typing import Callable, Dict, List, Set

from evaluation.ground_truth import GroundTruth
from evaluation.metrics import compute_f1, compute_precision, compute_recall


# Type alias: a *search function* accepts a query string and returns
# ranked results that contain at minimum a ``doc_id`` field.
SearchFn = Callable[[str], List[Dict]]


class Evaluator:
    """Run queries through one or more models and compute IR metrics.

    Parameters
    ----------
    ground_truth : GroundTruth
        Relevance judgments for each query.
    models : dict[str, SearchFn]
        Mapping of model name → callable that produces search results.
    top_k : int
        Number of results to evaluate per query.
    """

    def __init__(
        self,
        ground_truth: GroundTruth,
        models: Dict[str, SearchFn],
        top_k: int = 10,
    ) -> None:
        self.ground_truth = ground_truth
        self.models = models
        self.top_k = top_k

    # ── Core evaluation ───────────────────────────────────────────────

    def evaluate_all(self, queries: List[str] | None = None) -> Dict:
        """Evaluate every registered model on every query.

        Returns
        -------
        dict
            {
                "per_query": [ { query, results_by_model … }, … ],
                "global":    { model_name: { avg_precision, … }, … },
                "top_k":     int,
                "query_count": int,
            }
        """
        eval_queries = queries or self.ground_truth.queries
        if not eval_queries:
            return self._empty_report()

        per_query: List[Dict] = []
        # accumulators: model_name → list of per-query metric dicts
        accumulators: Dict[str, List[Dict[str, float]]] = {
            name: [] for name in self.models
        }

        for query_text in eval_queries:
            relevant: Set[str] = self.ground_truth.relevant_docs(query_text)
            query_entry: Dict = {
                "query": query_text,
                "relevant_count": len(relevant),
                "relevant_doc_ids": sorted(relevant),
                "models": {},
            }

            for model_name, search_fn in self.models.items():
                model_metrics = self._evaluate_single(
                    search_fn, query_text, relevant,
                )
                query_entry["models"][model_name] = model_metrics
                accumulators[model_name].append(model_metrics)

            per_query.append(query_entry)

        # Compute global averages
        global_metrics: Dict[str, Dict[str, float]] = {}
        for model_name, metric_list in accumulators.items():
            global_metrics[model_name] = self._average_metrics(metric_list)

        return {
            "per_query": per_query,
            "global": global_metrics,
            "top_k": self.top_k,
            "query_count": len(eval_queries),
        }

    # ── Internals ─────────────────────────────────────────────────────

    def _evaluate_single(
        self,
        search_fn: SearchFn,
        query: str,
        relevant: Set[str],
    ) -> Dict:
        """Run one model on one query and return metrics + result IDs."""
        raw_results = search_fn(query)
        top_results = raw_results[: self.top_k]
        retrieved: Set[str] = {r["doc_id"] for r in top_results}

        vp = retrieved & relevant
        fp = retrieved - relevant
        fn = relevant - retrieved

        precision = compute_precision(retrieved, relevant)
        recall = compute_recall(retrieved, relevant)
        f1 = compute_f1(precision, recall)

        return {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "vp": len(vp),
            "fp": len(fp),
            "fn": len(fn),
            "retrieved_count": len(retrieved),
            "retrieved_doc_ids": [r["doc_id"] for r in top_results],
        }

    @staticmethod
    def _average_metrics(metric_list: List[Dict[str, float]]) -> Dict[str, float]:
        if not metric_list:
            return {"avg_precision": 0.0, "avg_recall": 0.0, "avg_f1": 0.0}
        n = len(metric_list)
        return {
            "avg_precision": round(sum(m["precision"] for m in metric_list) / n, 4),
            "avg_recall": round(sum(m["recall"] for m in metric_list) / n, 4),
            "avg_f1": round(sum(m["f1"] for m in metric_list) / n, 4),
        }

    def _empty_report(self) -> Dict:
        return {
            "per_query": [],
            "global": {
                name: {"avg_precision": 0.0, "avg_recall": 0.0, "avg_f1": 0.0}
                for name in self.models
            },
            "top_k": self.top_k,
            "query_count": 0,
        }
