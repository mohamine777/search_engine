"""Evaluation module for IR model comparison (Precision, Recall, F1)."""

from evaluation.evaluator import Evaluator
from evaluation.ground_truth import GroundTruth
from evaluation.metrics import compute_precision, compute_recall, compute_f1

__all__ = [
    "Evaluator",
    "GroundTruth",
    "compute_precision",
    "compute_recall",
    "compute_f1",
]
