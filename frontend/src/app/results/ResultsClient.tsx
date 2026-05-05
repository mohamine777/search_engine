"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import MeasureSelector from "@/components/MeasureSelector";
import ModelSelector from "@/components/ModelSelector";
import ResultCard from "@/components/ResultCard";
import ResultsPanel from "@/components/ResultsPanel";
import SearchBar from "@/components/SearchBar";
import { searchDocuments, type SearchModel, type SearchResult, type VsmMeasure } from "@/lib/api";

type ComparisonMetrics = { precision: number; recall: number; f1: number; map: number; ndcg: number; aggregate: number };
type ComparisonState = { a: ComparisonMetrics; b: ComparisonMetrics; winner: "a" | "b" | null };

function normalizeModel(v: string | null, fb: SearchModel): SearchModel {
  return v === "vsm" || v === "bir" ? v : fb;
}

function normalizeMeasure(v: string | null, fb: VsmMeasure): VsmMeasure {
  const valid: VsmMeasure[] = ["cosine", "product", "euclidean", "dice", "jaccard", "overlap"];
  return valid.includes(v as VsmMeasure) ? (v as VsmMeasure) : fb;
}

function parseNumber(v: string | null, fb: number) { const p = Number(v); return Number.isFinite(p) ? p : fb; }
function supportsMeasure(m: SearchModel) { return m === "vsm"; }
function getModelLabel(m: SearchModel) { return m === "bir" ? "BIR" : "VSM"; }
function zeroMetrics(): ComparisonMetrics { return { precision: 0, recall: 0, f1: 0, map: 0, ndcg: 0, aggregate: 0 }; }

function evaluateComparison(primary: SearchResult[], secondary: SearchResult[]): ComparisonMetrics {
  if (!primary.length || !secondary.length) return zeroMetrics();
  const relevant = new Set(secondary.map((r) => r.doc_id));
  const idealDiscount = secondary.reduce((s, _, i) => s + 1 / Math.log2(i + 2), 0) || 1;
  let wR = 0, wT = 0, hits = 0, ap = 0, dcg = 0;
  primary.forEach((r, i) => {
    const d = 1 / Math.log2(i + 2);
    wT += d;
    if (relevant.has(r.doc_id)) { hits++; wR += d; ap += hits / (i + 1); dcg += d; }
  });
  const precision = wR / wT, recall = wR / idealDiscount;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const map = relevant.size === 0 ? 0 : ap / relevant.size;
  const ndcg = dcg / idealDiscount;
  return { precision, recall, f1, map, ndcg, aggregate: (precision + recall + f1 + map + ndcg) / 5 };
}

export default function ResultsClient() {
  const params = useSearchParams();
  const compareMode = params.get("mode") === "compare";
  const [query, setQuery] = useState(params.get("q") || "");
  const [model, setModel] = useState<SearchModel>(normalizeModel(params.get("model"), "vsm"));
  const [measure, setMeasure] = useState<VsmMeasure>(normalizeMeasure(params.get("measure"), "cosine"));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [comparedResults, setComparedResults] = useState<{ a: SearchResult[]; b: SearchResult[] }>({ a: [], b: [] });
  const [comparison, setComparison] = useState<ComparisonState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compareA = { query: params.get("queryA") || "", model: normalizeModel(params.get("modelA"), "vsm"), measure: normalizeMeasure(params.get("measureA"), "cosine") };
  const compareB = { query: params.get("queryB") || "", model: normalizeModel(params.get("modelB"), "bir"), measure: normalizeMeasure(params.get("measureB"), "cosine") };

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try { setResults(await searchDocuments({ query, model, measure, top_k: 20 })); }
    catch (e) { setError(e instanceof Error ? e.message : "Search failed"); }
    finally { setLoading(false); }
  };

  const runCompare = async () => {
    if (!compareA.query.trim() || !compareB.query.trim()) { setError("Both queries are required."); return; }
    setLoading(true); setError(null);
    try {
      const [rA, rB] = await Promise.all([
        searchDocuments({ query: compareA.query, model: compareA.model, measure: compareA.measure, top_k: 20 }),
        searchDocuments({ query: compareB.query, model: compareB.model, measure: compareB.measure, top_k: 20 }),
      ]);
      const mA = evaluateComparison(rA, rB), mB = evaluateComparison(rB, rA);
      setComparedResults({ a: rA, b: rB });
      setComparison({ a: mA, b: mB, winner: mA.aggregate === mB.aggregate ? null : mA.aggregate > mB.aggregate ? "a" : "b" });
    } catch (e) { setError(e instanceof Error ? e.message : "Compare failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void (compareMode ? runCompare() : runSearch()); }, []);

  if (compareMode) {
    const bestLabel = comparison?.winner === "a" ? `Model A (${getModelLabel(compareA.model)})` : comparison?.winner === "b" ? `Model B (${getModelLabel(compareB.model)})` : "No clear winner";
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-[linear-gradient(135deg,rgba(11,18,32,0.96),rgba(17,24,39,0.9))] px-6 py-5 shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d4af37]">Compare Mode</p><h1 className="mt-1 text-3xl font-black text-[#f9fafb]">VSM vs BIR</h1></div>
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:border-[#d4af37] hover:text-white">New comparison</Link>
        </div>
        {loading && <p className="rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#111827] p-4 text-sm font-semibold text-[#cbd5e1]">Comparing...</p>}
        {error && <p className="rounded-xl border border-red-400/20 bg-red-950/30 p-4 text-sm text-red-200">{error}</p>}
        {!loading && !error && (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <ResultsPanel title={`Model A · ${getModelLabel(compareA.model)}`} subtitle={compareA.query} query={compareA.query} results={comparedResults.a} highlight={comparison?.winner === "a"} />
              <ResultsPanel title={`Model B · ${getModelLabel(compareB.model)}`} subtitle={compareB.query} query={compareB.query} results={comparedResults.b} highlight={comparison?.winner === "b"} />
            </section>
            <section className="rounded-xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d4af37]">Metrics</p><h2 className="mt-1 text-2xl font-black text-[#f9fafb]">Precision, Recall, F1, MAP, NDCG</h2></div>
                <div className="rounded-full border border-[#d4af37] bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#0b1220]">Best: {bestLabel}</div>
              </div>
              {comparison && (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <ComparisonCard title={`Model A · ${getModelLabel(compareA.model)}`} metrics={comparison.a} highlight={comparison.winner === "a"} />
                  <ComparisonCard title={`Model B · ${getModelLabel(compareB.model)}`} metrics={comparison.b} highlight={comparison.winner === "b"} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d4af37]">Resultats</p><h1 className="mt-1 text-3xl font-black text-[#f9fafb]">Recherche et RSV</h1></div>
        <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:border-[#d4af37] hover:text-white">Nouvelle recherche</Link>
      </div>
      <section className="grid gap-4 rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:grid-cols-2">
        <div className="md:col-span-2"><SearchBar query={query} setQuery={setQuery} onSearch={runSearch} /></div>
        <ModelSelector model={model} onChange={setModel} />
        {supportsMeasure(model) && <MeasureSelector measure={measure} onChange={setMeasure} />}
      </section>
      {loading && <p className="rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#111827] p-4 text-sm font-semibold text-[#cbd5e1]">Recherche en cours...</p>}
      {error && <p className="rounded-xl border border-red-400/20 bg-red-950/30 p-4 text-sm text-red-200">{error}</p>}
      {!loading && !error && <p className="text-sm text-[#cbd5e1]">{results.length} document(s) — {getModelLabel(model)}{supportsMeasure(model) ? ` / ${measure}` : ""}.</p>}
      <section className="space-y-4">{results.map((r) => <ResultCard key={r.doc_id} result={r} />)}</section>
    </div>
  );
}

function ComparisonCard({ title, metrics, highlight }: { title: string; metrics: ComparisonMetrics; highlight: boolean }) {
  return (
    <section className={highlight ? "rounded-xl border border-[rgba(212,175,55,0.3)] border-t-4 border-t-[#d4af37] bg-[#0b1220] p-5" : "rounded-xl border border-white/8 border-t-4 border-t-[#d4af37]/70 bg-[#0b1220] p-5"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#f9fafb]">{title}</h3>
        {highlight && <span className="rounded-full border border-[#d4af37] bg-[#d4af37] px-3 py-1 text-xs font-semibold text-[#0b1220]">Best</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(["precision", "recall", "f1", "map", "ndcg", "aggregate"] as const).map((k) => (
          <div key={k} className="rounded-xl border border-white/8 bg-[#111827] px-4 py-4">
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-[#cbd5e1]">{k === "aggregate" ? "score" : k}</p>
            <p className="mt-2 text-xl font-bold text-[#f9fafb]">{metrics[k].toFixed(3)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
