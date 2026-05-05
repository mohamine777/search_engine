"""Unit tests for the two retained retrieval models: VSM and BIR."""

import unittest
from pathlib import Path

from indexer import Indexer


class VSMModelTests(unittest.TestCase):
    """Verify the Vector Space Model via the Indexer-backed wrapper."""

    def setUp(self):
        from models.vsm_model import VectorSpaceModel

        self.indexer = Indexer()
        self.indexer.add_document(
            text="cat cat dog",
            metadata={"filename": "d1.txt", "title": "D1"},
            doc_id="d1",
        )
        self.indexer.add_document(
            text="cat",
            metadata={"filename": "d2.txt", "title": "D2"},
            doc_id="d2",
        )
        self.indexer.add_document(
            text="dog",
            metadata={"filename": "d3.txt", "title": "D3"},
            doc_id="d3",
        )
        self.indexer.recompute()
        self.vsm = VectorSpaceModel(self.indexer)

    def test_cosine_returns_results(self):
        results = self.vsm.search("cat", measure="cosine")
        self.assertGreater(len(results), 0)
        doc_ids = [r["doc_id"] for r in results]
        self.assertIn("d1", doc_ids)
        self.assertIn("d2", doc_ids)

    def test_inner_product(self):
        results = self.vsm.search("cat", measure="product")
        self.assertGreater(len(results), 0)

    def test_empty_query_returns_empty(self):
        results = self.vsm.search("")
        self.assertEqual(len(results), 0)


class BIRModelTests(unittest.TestCase):
    """Verify the Binary Independence Retrieval model."""

    def setUp(self):
        from models.bir_model import BIRModel

        self.indexer = Indexer()
        # Build a corpus large enough that query terms are discriminative
        # (n_t < N/2 so that the simplified BIR weight is positive).
        self.indexer.add_document(
            text="information retrieval systems ranking",
            metadata={"filename": "d1.txt", "title": "D1"},
            doc_id="d1",
        )
        self.indexer.add_document(
            text="machine learning classification neural",
            metadata={"filename": "d2.txt", "title": "D2"},
            doc_id="d2",
        )
        self.indexer.add_document(
            text="database management storage query",
            metadata={"filename": "d3.txt", "title": "D3"},
            doc_id="d3",
        )
        self.indexer.add_document(
            text="information retrieval probabilistic model",
            metadata={"filename": "d4.txt", "title": "D4"},
            doc_id="d4",
        )
        self.indexer.add_document(
            text="network security cryptography protocols",
            metadata={"filename": "d5.txt", "title": "D5"},
            doc_id="d5",
        )
        self.indexer.add_document(
            text="operating systems kernel scheduler memory",
            metadata={"filename": "d6.txt", "title": "D6"},
            doc_id="d6",
        )
        self.indexer.recompute()
        self.bir = BIRModel(self.indexer)

    def test_simplified_scoring_no_feedback(self):
        """Without feedback, BIR uses log((N - n_t + 0.5) / (n_t + 0.5))."""
        results = self.bir.search("information retrieval")
        self.assertGreater(len(results), 0)
        # d1 and d4 both contain both terms → should score higher than docs with one term
        top_ids = [r["doc_id"] for r in results[:2]]
        self.assertIn("d1", top_ids)

    def test_full_scoring_with_feedback(self):
        """With relevance feedback, BIR uses the full p_t / q_t estimation."""
        results = self.bir.search(
            "information retrieval",
            relevant_doc_ids={"d1", "d4"},
        )
        self.assertGreater(len(results), 0)
        # With feedback marking d1 and d4 as relevant, they should be ranked highly
        top_ids = [r["doc_id"] for r in results[:2]]
        self.assertIn("d1", top_ids)

    def test_empty_query_returns_empty(self):
        results = self.bir.search("")
        self.assertEqual(len(results), 0)

    def test_scores_are_positive(self):
        results = self.bir.search("retrieval")
        for r in results:
            self.assertGreater(r["score"], 0.0)

    def test_results_are_sorted_descending(self):
        results = self.bir.search("information retrieval")
        scores = [r["score"] for r in results]
        self.assertEqual(scores, sorted(scores, reverse=True))


if __name__ == "__main__":
    unittest.main()
