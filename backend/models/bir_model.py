"""Binary Independence Retrieval (BIR) Model.

Implements the classical probabilistic retrieval model described by
Robertson & Spärck Jones (1976).  The model ranks documents by the
log-odds of relevance under the Binary Independence Assumption:

    RSV(d, q) = Σ_{t ∈ q ∩ d}  c_t

where c_t is the Robertson–Spärck Jones weight for term t.

Parameter estimation
--------------------
When *no relevance feedback* is available the model falls back to the
well-known approximation that assumes all query terms are equally likely
in relevant documents (p_i = 0.5):

    c_t = log  (N - n_t + 0.5)
               ────────────────
                  (n_t + 0.5)

where
    N   = total number of documents in the corpus
    n_t = number of documents containing term t

When a relevance feedback set R is provided (|R| documents judged
relevant), the full BIR formula is used:

    c_t = log  (r_t + 0.5) / (R - r_t + 0.5)
               ────────────────────────────────
               (n_t - r_t + 0.5) / (N - n_t - R + r_t + 0.5)

where
    r_t = number of relevant documents containing term t

The +0.5 additive constants provide Laplace-style smoothing to avoid
log(0) when a term never appears (or always appears) in the relevant /
non-relevant partitions.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Set


class BIRModel:
    """Robertson–Spärck Jones Binary Independence Retrieval model.

    The model scores documents using the Probabilistic Ranking Principle
    (PRP): documents are ranked by decreasing probability of relevance
    given a query, which is monotonic in the Retrieval Status Value
    (RSV) computed below.

    Attributes
    ----------
    indexer : Indexer
        Shared indexing backend providing term-document statistics.
    """

    def __init__(self, indexer) -> None:
        self.indexer = indexer

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search(
        self,
        query: str,
        *,
        relevant_doc_ids: Optional[Set[str]] = None,
    ) -> List[Dict]:
        """Rank corpus documents for *query* using BIR log-odds scoring.

        Parameters
        ----------
        query : str
            Free-text query string (will be preprocessed identically to
            indexed documents).
        relevant_doc_ids : set[str] | None
            Optional set of document ids judged relevant for this query.
            When provided the full BIR parameter estimation is used;
            otherwise the simplified Robertson–Spärck Jones IDF
            approximation is applied.

        Returns
        -------
        list[dict]
            Ranked list of result dicts (highest RSV first).  Each dict
            contains ``doc_id``, ``title``, ``score``, ``text`` and
            ``metadata``.
        """
        query_terms: Set[str] = set(self.indexer.preprocessor.preprocess(query))
        if not query_terms:
            return []

        N: int = self.indexer.document_count
        if N == 0:
            return []

        # Pre-compute term weights once per query
        term_weights: Dict[str, float] = {}
        for term in query_terms:
            weight = self._term_weight(
                term, N=N, relevant_doc_ids=relevant_doc_ids,
            )
            if weight > 0.0:
                term_weights[term] = weight

        if not term_weights:
            return []

        # Score every document
        results: List[Dict] = []
        for doc_id, doc_freqs in self.indexer.doc_term_freqs.items():
            doc_terms: Set[str] = set(doc_freqs.keys())
            rsv = 0.0
            for term in query_terms & doc_terms:
                rsv += term_weights.get(term, 0.0)
            if rsv > 0.0:
                results.append(self._result(doc_id, rsv))

        results.sort(key=lambda item: item["score"], reverse=True)
        return results

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _term_weight(
        self,
        term: str,
        *,
        N: int,
        relevant_doc_ids: Optional[Set[str]] = None,
    ) -> float:
        """Compute the Robertson–Spärck Jones weight c_t for *term*.

        Parameters
        ----------
        term : str
            A single preprocessed term.
        N : int
            Total number of documents in the corpus.
        relevant_doc_ids : set[str] | None
            If provided, compute c_t using relevance feedback;
            otherwise fall back to the simplified IDF-like formula.

        Returns
        -------
        float
            The BIR term weight (always ≥ 0; terms with negative
            discriminative power are clamped to 0).
        """
        n_t: int = len(self.indexer.postings(term))
        if n_t == 0:
            return 0.0

        if relevant_doc_ids is not None and len(relevant_doc_ids) > 0:
            return self._full_weight(term, N=N, n_t=n_t,
                                     relevant_doc_ids=relevant_doc_ids)
        return self._simplified_weight(N=N, n_t=n_t)

    @staticmethod
    def _simplified_weight(*, N: int, n_t: int) -> float:
        """Simplified BIR weight when no relevance data is available.

        RSV contribution of term t:

            c_t = log( (N - n_t + 0.5) / (n_t + 0.5) )

        This is the standard Robertson–Spärck Jones IDF approximation
        obtained by setting p_t = 0.5 for every query term.  The +0.5
        smoothing prevents division by zero and stabilises estimates for
        rare / very common terms.
        """
        numerator = (N - n_t) + 0.5
        denominator = n_t + 0.5
        weight = math.log(numerator / denominator)
        return max(0.0, weight)

    def _full_weight(
        self,
        term: str,
        *,
        N: int,
        n_t: int,
        relevant_doc_ids: Set[str],
    ) -> float:
        """Full BIR weight using relevance feedback.

        c_t = log  [ (r_t + 0.5) / (R - r_t + 0.5) ]
                    ──────────────────────────────────
                    [ (n_t - r_t + 0.5) / (N - n_t - R + r_t + 0.5) ]

        where
            R   = |relevant_doc_ids|
            r_t = number of relevant docs containing term t
            n_t = total docs containing term t
            N   = total docs in the corpus

        All components are smoothed with +0.5 (Laplace correction).
        """
        R: int = len(relevant_doc_ids)
        postings_for_term: Dict[str, int] = self.indexer.postings(term)
        r_t: int = sum(1 for doc_id in relevant_doc_ids
                       if doc_id in postings_for_term)

        # p_t estimate: probability term appears in relevant docs
        p_t_num = r_t + 0.5
        p_t_den = R - r_t + 0.5

        # q_t estimate: probability term appears in non-relevant docs
        q_t_num = (n_t - r_t) + 0.5
        q_t_den = (N - n_t - R + r_t) + 0.5

        # Guard against degenerate denominators
        if p_t_den <= 0 or q_t_den <= 0 or q_t_num <= 0:
            return 0.0

        weight = math.log((p_t_num / p_t_den) / (q_t_num / q_t_den))
        return max(0.0, weight)

    def _result(self, doc_id: str, score: float) -> Dict:
        """Format a single result dict matching the shared output schema."""
        doc = self.indexer.documents[doc_id]
        return {
            "doc_id": doc_id,
            "title": doc["title"],
            "score": round(score, 6),
            "text": doc["text"],
            "metadata": doc["metadata"],
        }
