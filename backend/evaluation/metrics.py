"""Pure metric functions — no side effects, no model dependencies.

Each function takes the three fundamental sets and returns a float [0, 1].
"""

from __future__ import annotations

from typing import Set


def compute_precision(retrieved: Set[str], relevant: Set[str]) -> float:
    """Precision = |VP| / |retrieved|.

    VP (true positives) = retrieved ∩ relevant.
    FP (false positives) = retrieved − relevant.
    Precision = VP / (VP + FP) = VP / |retrieved|.
    """
    if not retrieved:
        return 0.0
    vp = len(retrieved & relevant)
    return vp / len(retrieved)


def compute_recall(retrieved: Set[str], relevant: Set[str]) -> float:
    """Recall = |VP| / |relevant|.

    VP  = retrieved ∩ relevant.
    FN  = relevant − retrieved.
    Recall = VP / (VP + FN) = VP / |relevant|.
    """
    if not relevant:
        return 0.0
    vp = len(retrieved & relevant)
    return vp / len(relevant)


def compute_f1(precision: float, recall: float) -> float:
    """F1 = 2 * Precision * Recall / (Precision + Recall)."""
    if precision + recall == 0.0:
        return 0.0
    return 2.0 * precision * recall / (precision + recall)
