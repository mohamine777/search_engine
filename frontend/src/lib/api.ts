const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type SearchModel = "vsm" | "bir";
export type VsmMeasure = "cosine" | "product" | "euclidean" | "dice" | "jaccard" | "overlap";

export type SearchResult = {
  doc_id: string;
  title: string;
  score: number;
  snippet: string;
  model: SearchModel;
  metadata: Record<string, string>;
};

export type CorpusStats = {
  documents: number;
  terms: number;
  index_size: number;
  top_terms: Array<{ term: string; tf: number; df: number; idf: number; tf_idf: number }>;
};

export type DocumentRecord = {
  doc_id: string;
  title: string;
  metadata: Record<string, string>;
  token_count: number;
  indexed: boolean;
  size: number;
  upload_date: string;
  preview_snippet: string;
};

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || body?.error || `${response.status} ${response.statusText}`);
  }
  return response;
}

export async function searchDocuments(payload: {
  query: string;
  model: SearchModel;
  measure?: VsmMeasure;
  top_k?: number;
}): Promise<SearchResult[]> {
  const response = await request("/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function uploadDocuments(files: File[], clear = false) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await request(`/index?clear=${clear ? "true" : "false"}`, {
    method: "POST",
    body: formData,
  });
  return response.json();
}

export async function uploadDocument(file: File) {
  return uploadDocuments([file], false);
}

export async function fetchStats(): Promise<CorpusStats> {
  const response = await request("/stats", { cache: "no-store" });
  return response.json();
}

export type TfidfTable = {
  documents: number;
  total_terms: number;
  terms: Array<{ term: string; tf: number; df: number; idf: number; tf_idf: number }>;
};

export async function fetchTfidfTable(): Promise<TfidfTable> {
  const response = await request("/stats/tfidf", { cache: "no-store" });
  return response.json();
}

export async function fetchSuggestions(query: string): Promise<string[]> {
  const params = new URLSearchParams({ q: query, limit: "8" });
  const response = await request(`/suggest?${params.toString()}`, { cache: "no-store" });
  return response.json();
}

export async function fetchDocuments() {
  const response = await request("/documents", { cache: "no-store" });
  return response.json();
}

export async function fetchDocument(docId: string) {
  const response = await request(`/documents/${docId}`, { cache: "no-store" });
  return response.json();
}

export async function deleteDocument(docId: string) {
  const response = await request(`/documents/${docId}`, { method: "DELETE" });
  return response.json();
}

export async function reindexDocument(docId: string) {
  const response = await request(`/documents/${docId}/reindex`, { method: "POST" });
  return response.json();
}

export async function submitFeedback(_query: string, _docId: string, _relevant: boolean) {
  return { success: true };
}

// ── Evaluation types & functions ────────────────────────────────────

export type ModelMetrics = {
  precision: number;
  recall: number;
  f1: number;
  vp: number;
  fp: number;
  fn: number;
  retrieved_count: number;
  retrieved_doc_ids: string[];
};

export type PerQueryResult = {
  query: string;
  relevant_count: number;
  relevant_doc_ids: string[];
  models: Record<string, ModelMetrics>;
};

export type GlobalMetrics = {
  avg_precision: number;
  avg_recall: number;
  avg_f1: number;
};

export type EvaluationReport = {
  per_query: PerQueryResult[];
  global: Record<string, GlobalMetrics>;
  top_k: number;
  query_count: number;
};

export type GroundTruthData = {
  queries: string[];
  query_count: number;
  judgments: Record<string, string[]>;
};

export async function runEvaluation(payload: {
  queries?: string[];
  top_k?: number;
  measure?: string;
}): Promise<EvaluationReport> {
  const response = await request("/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function fetchGroundTruth(): Promise<GroundTruthData> {
  const response = await request("/ground-truth", { cache: "no-store" });
  return response.json();
}

export async function updateGroundTruth(judgments: Record<string, string[]>): Promise<GroundTruthData> {
  const response = await request("/ground-truth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ judgments }),
  });
  return response.json();
}

export async function autoGenerateGroundTruth(): Promise<GroundTruthData> {
  const response = await request("/ground-truth/auto-generate", { method: "POST" });
  return response.json();
}
