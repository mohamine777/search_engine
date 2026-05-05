"""FastAPI application for the IR search engine.

Supported retrieval models:
    - vsm:  Salton SMART-style TF-IDF Vector Space Model
    - bir:  Robertson–Spärck Jones Binary Independence Retrieval
"""

from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Literal, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from evaluation.evaluator import Evaluator
from evaluation.ground_truth import GroundTruth
from indexer import Indexer
from models.bir_model import BIRModel
from models.vsm_model import VectorSpaceModel

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
SAMPLE_DIR = BASE_DIR / "sample_corpus"
DATA_DIR = BASE_DIR / "data"

app = FastAPI(title="Moteur de Recherche RI", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared index & retrieval models ──────────────────────────────────
indexer = Indexer(DATA_DIR / "index.json")
vsm_model = VectorSpaceModel(indexer)
bir_model = BIRModel(indexer)

# ── Evaluation ───────────────────────────────────────────────────────
ground_truth = GroundTruth(DATA_DIR / "ground_truth.json")

DEFAULT_EVAL_QUERIES = [
    "recherche information index inverse",
    "vector space model TF-IDF cosine",
    "probabilistic retrieval BIR Robertson",
    "boolean query AND OR NOT",
    "evaluation precision recall",
    "pretraitement tokenisation racinisation",
    "fuzzy retrieval membership",
    "FastAPI backend search engine",
]


# ── Request / response schemas ───────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    model: Literal["vsm", "bir"] = "vsm"
    measure: Literal["cosine", "product", "inner_product", "euclidean", "euclidean_distance", "dice", "jaccard", "overlap", "overlap_coefficient"] = "cosine"
    top_k: int = 10


class IndexResponse(BaseModel):
    indexed: int
    document_ids: List[str]
    total_documents: int


class EvaluateRequest(BaseModel):
    queries: Optional[List[str]] = Field(None, description="Queries to evaluate. If omitted, use all ground truth queries.")
    top_k: int = Field(10, ge=1, le=100, description="Number of results to evaluate per model.")
    measure: str = Field("cosine", description="VSM similarity measure to use.")


class GroundTruthUpdate(BaseModel):
    judgments: Dict[str, List[str]] = Field(..., description="Mapping of query text → list of relevant doc IDs.")


# ── Lifecycle ────────────────────────────────────────────────────────

@app.on_event("startup")
def startup() -> None:
    UPLOAD_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)
    loaded = indexer.load()
    if not loaded or indexer.document_count == 0:
        indexer.index_paths(SAMPLE_DIR.glob("*.txt"), clear=True)
    # Load or auto-generate ground truth
    if not ground_truth.load():
        ground_truth.auto_generate(DEFAULT_EVAL_QUERIES, indexer)
        ground_truth.save()


# ── Health ───────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "documents": indexer.document_count}


# ── Indexing ─────────────────────────────────────────────────────────

@app.post("/index", response_model=IndexResponse)
async def index_documents(files: List[UploadFile] = File(...), clear: bool = False) -> dict:
    paths = []
    for file in files:
        safe_name = Path(file.filename or "document.txt").name
        if Path(safe_name).suffix.lower() not in {".txt", ".pdf"}:
            raise HTTPException(status_code=400, detail="Only .txt and .pdf files are supported by /index")
        target = UPLOAD_DIR / safe_name
        with target.open("wb") as handle:
            shutil.copyfileobj(file.file, handle)
        paths.append(target)
    doc_ids = indexer.index_paths(paths, clear=clear)
    return {"indexed": len(doc_ids), "document_ids": doc_ids, "total_documents": indexer.document_count}


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)) -> dict:
    response = await index_documents([file], clear=False)
    return {
        "success": True,
        "doc_id": response["document_ids"][0] if response["document_ids"] else None,
        "filename": Path(file.filename or "document.txt").name,
        "message": "Document ajoute et indexe avec succes",
        "document_count": response["total_documents"],
    }


# ── Search ───────────────────────────────────────────────────────────

@app.post("/search")
def search(payload: SearchRequest) -> List[dict]:
    model = payload.model

    if model == "vsm":
        results = vsm_model.search(payload.query, measure=payload.measure)
    elif model == "bir":
        results = bir_model.search(payload.query)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model: {model}")

    return [_format_result(result, payload.query, model) for result in results[: payload.top_k]]


# ── Documents CRUD ───────────────────────────────────────────────────

@app.get("/documents")
def list_documents() -> List[dict]:
    return [
        {
            "doc_id": doc_id,
            "title": doc["title"],
            "metadata": doc["metadata"],
            "token_count": len(doc["tokens"]),
            "indexed": True,
            "size": _document_size(doc),
            "upload_date": _document_upload_date(doc),
            "preview_snippet": _document_preview(doc),
        }
        for doc_id, doc in indexer.documents.items()
    ]


@app.get("/documents/{doc_id}")
def get_document(doc_id: str) -> dict:
    doc = indexer.documents.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@app.post("/documents/{doc_id}/reindex")
def reindex_document(doc_id: str) -> dict:
    doc = indexer.documents.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    source_path = Path(doc.get("metadata", {}).get("path", ""))
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Source file not found")

    text = indexer.extract_text(source_path)
    metadata = dict(doc.get("metadata", {}))
    metadata.setdefault("filename", source_path.name)
    metadata.setdefault("extension", source_path.suffix.lower())
    metadata["path"] = str(source_path)
    metadata["date"] = _document_upload_date(doc)

    indexer.remove_document(doc_id)
    indexer.add_document(text=text, metadata=metadata, doc_id=doc_id)
    indexer.recompute()
    indexer.save()
    return {"success": True, "doc_id": doc_id}


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str) -> dict:
    if not indexer.remove_document(doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True, "doc_id": doc_id}


# ── Stats ────────────────────────────────────────────────────────────

@app.get("/stats")
def stats() -> dict:
    postings_count = sum(len(postings) for postings in indexer.inverted_index.values())
    return {
        "documents": indexer.document_count,
        "terms": len(indexer.inverted_index),
        "index_size": postings_count,
        "top_terms": indexer.top_terms(15),
    }


@app.get("/metrics")
def metrics() -> dict:
    corpus_stats = stats()
    return {
        "feedback_count": 0,
        "precision": 0,
        "recall": 0,
        "f1": 0,
        **corpus_stats,
    }


@app.get("/stats/tfidf")
def tfidf_table() -> dict:
    """Return the complete TF×IDF ranked statistics table for all terms."""
    table = indexer.term_statistics()
    return {
        "documents": indexer.document_count,
        "total_terms": len(table),
        "terms": table,
    }


@app.get("/suggest")
def suggest(q: str = "", limit: int = 8) -> List[str]:
    stemmed = indexer.preprocessor.preprocess(q)
    prefix = stemmed[-1] if stemmed else q.lower().strip()
    if not prefix:
        return [item["term"] for item in indexer.top_terms(limit)]
    matches = [term for term in indexer.vocabulary if term.startswith(prefix)]
    return matches[:limit]


# ── Evaluation ───────────────────────────────────────────────────────

@app.post("/evaluate")
def evaluate(payload: EvaluateRequest) -> dict:
    """Run VSM and BIR on ground truth queries and return IR metrics."""
    def vsm_search(q: str) -> List[dict]:
        return vsm_model.search(q, measure=payload.measure)

    def bir_search(q: str) -> List[dict]:
        return bir_model.search(q)

    evaluator = Evaluator(
        ground_truth=ground_truth,
        models={"vsm": vsm_search, "bir": bir_search},
        top_k=payload.top_k,
    )
    return evaluator.evaluate_all(queries=payload.queries)


@app.get("/ground-truth")
def get_ground_truth() -> dict:
    """Return current ground truth relevance judgments."""
    return {
        "queries": ground_truth.queries,
        "query_count": len(ground_truth.queries),
        "judgments": ground_truth.to_dict(),
    }


@app.post("/ground-truth")
def update_ground_truth(payload: GroundTruthUpdate) -> dict:
    """Replace ground truth judgments for the given queries."""
    for query_text, doc_ids in payload.judgments.items():
        # Validate that doc IDs exist
        unknown = [d for d in doc_ids if d not in indexer.documents]
        if unknown:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown doc IDs for query '{query_text}': {unknown}",
            )
        ground_truth.set_relevant(query_text, doc_ids)
    ground_truth.save()
    return {
        "success": True,
        "query_count": len(ground_truth.queries),
        "judgments": ground_truth.to_dict(),
    }


@app.post("/ground-truth/auto-generate")
def auto_generate_ground_truth() -> dict:
    """Regenerate ground truth from the inverted index heuristic."""
    ground_truth.auto_generate(DEFAULT_EVAL_QUERIES, indexer)
    ground_truth.save()
    return {
        "success": True,
        "query_count": len(ground_truth.queries),
        "judgments": ground_truth.to_dict(),
    }


# ── Private helpers ──────────────────────────────────────────────────

def _format_result(result: dict, original_query: str, model: str) -> dict:
    return {
        "doc_id": result["doc_id"],
        "title": result["title"],
        "score": result["score"],
        "snippet": _snippet(result["text"], original_query),
        "metadata": result["metadata"],
        "model": model,
    }


def _document_path(doc: dict) -> Path | None:
    path_value = doc.get("metadata", {}).get("path")
    if not path_value:
        return None
    return Path(path_value)


def _document_size(doc: dict) -> int:
    path = _document_path(doc)
    if path and path.exists():
        return path.stat().st_size
    return len(doc.get("text", "").encode("utf-8"))


def _document_upload_date(doc: dict) -> str:
    metadata = doc.get("metadata", {})
    if metadata.get("date"):
        return str(metadata["date"])
    path = _document_path(doc)
    if path and path.exists():
        return datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds")
    return ""


def _document_preview(doc: dict, width: int = 180) -> str:
    text = (doc.get("text") or "").strip().replace("\n", " ")
    if len(text) <= width:
        return text
    return text[:width].rstrip() + "..."


def _snippet(text: str, query: str, width: int = 220) -> str:
    operators = {"and", "or", "not"}
    tokens = [
        re.escape(token)
        for token in re.findall(r"[A-Za-zÀ-ÿ0-9']+", query)
        if len(token) > 1 and token.lower() not in operators
    ]
    if not tokens:
        return text[:width]
    match = re.search("|".join(tokens), text, flags=re.IGNORECASE)
    start = max(0, (match.start() if match else 0) - 70)
    snippet = text[start : start + width]
    for token in tokens:
        snippet = re.sub(f"({token})", r"<mark>\1</mark>", snippet, flags=re.IGNORECASE)
    return ("..." if start else "") + snippet + ("..." if start + width < len(text) else "")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
