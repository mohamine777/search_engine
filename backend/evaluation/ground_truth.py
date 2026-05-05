"""Ground truth store for relevance judgments.

A GroundTruth instance maps query strings to the set of document IDs
known to be relevant for that query.  Relevance data can be:
  - loaded from a JSON file   (``load`` / ``save``)
  - populated programmatically (``set_relevant``)
  - auto-generated heuristically from the corpus (``auto_generate``)

The auto-generation heuristic is intentionally simple: a document is
relevant for a query if *at least one* query term appears in the
document's token list.  This gives a reasonable baseline when no human
judgments are available but should be replaced with curated data for
serious evaluations.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Set


class GroundTruth:
    """Relevance judgments keyed by query text."""

    def __init__(self, store_path: Optional[Path] = None) -> None:
        self._store_path = store_path
        self._judgments: Dict[str, Set[str]] = {}

    # ── Public API ────────────────────────────────────────────────────

    @property
    def queries(self) -> List[str]:
        """Return all queries that have relevance data."""
        return list(self._judgments.keys())

    def relevant_docs(self, query: str) -> Set[str]:
        """Return the set of relevant doc IDs for *query*."""
        return set(self._judgments.get(query, set()))

    def set_relevant(self, query: str, doc_ids: List[str] | Set[str]) -> None:
        """Set (or replace) the relevant document set for *query*."""
        self._judgments[query] = set(doc_ids)

    def remove_query(self, query: str) -> bool:
        """Remove a query's judgments.  Returns True if it existed."""
        return self._judgments.pop(query, None) is not None

    # ── Auto-generation heuristic ─────────────────────────────────────

    def auto_generate(self, queries: List[str], indexer) -> None:
        """Build baseline relevance judgments from the inverted index.

        A document is considered relevant for a query when at least one
        preprocessed query term appears in the document's token set.
        """
        for query_text in queries:
            query_terms = set(indexer.preprocessor.preprocess(query_text))
            relevant: Set[str] = set()
            for doc_id, doc in indexer.documents.items():
                doc_tokens = set(doc.get("tokens", []))
                if query_terms & doc_tokens:
                    relevant.add(doc_id)
            self._judgments[query_text] = relevant

    # ── Persistence ───────────────────────────────────────────────────

    def save(self, path: Optional[Path] = None) -> None:
        target = path or self._store_path
        if target is None:
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = {q: sorted(ids) for q, ids in self._judgments.items()}
        target.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    def load(self, path: Optional[Path] = None) -> bool:
        target = path or self._store_path
        if target is None or not target.exists():
            return False
        try:
            payload = json.loads(target.read_text(encoding="utf-8"))
            self._judgments = {q: set(ids) for q, ids in payload.items()}
            return True
        except (json.JSONDecodeError, TypeError):
            return False

    # ── Representation ────────────────────────────────────────────────

    def to_dict(self) -> Dict[str, List[str]]:
        return {q: sorted(ids) for q, ids in self._judgments.items()}
