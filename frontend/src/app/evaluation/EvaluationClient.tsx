"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import {
  autoGenerateGroundTruth,
  runEvaluation,
  type EvaluationReport,
  type GlobalMetrics,
  type ModelMetrics,
  type PerQueryResult,
} from "@/lib/api";

const MODEL_LABELS: Record<string, string> = { vsm: "VSM", bir: "BIR" };
const MEASURES = ["cosine", "product", "euclidean", "dice", "jaccard", "overlap"] as const;

function label(model: string) {
  return MODEL_LABELS[model] ?? model.toUpperCase();
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function barColor(v: number) {
  if (v >= 0.7) return "#22c55e";
  if (v >= 0.4) return "#eab308";
  return "#ef4444";
}

export default function EvaluationClient() {
  const [topK, setTopK] = useState(10);
  const [measure, setMeasure] = useState("cosine");
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runEvaluation({ top_k: topK, measure });
      setReport(data);
      setExpandedQuery(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  }, [topK, measure]);

  const regenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await autoGenerateGroundTruth();
      const data = await runEvaluation({ top_k: topK, measure });
      setReport(data);
      setExpandedQuery(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setLoading(false);
    }
  }, [topK, measure]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* ─── Header ─── */}
      <section className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(135deg,rgba(11,18,32,0.96),rgba(17,24,39,0.9))] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:flex-row md:items-end md:justify-between md:px-8 md:py-10">
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d4af37]">
            Module d&apos;évaluation
          </p>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-[#f9fafb] md:text-5xl">
            VSM vs BIR
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[#cbd5e1]">
            Precision, Recall et F1-score sur le ground truth du corpus.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-[#cbd5e1] transition hover:border-[#d4af37] hover:text-white"
        >
          ← Recherche
        </Link>
      </section>

      {/* ─── Controls ─── */}
      <section className="grid gap-4 rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:grid-cols-[1fr_1fr_auto_auto]">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#cbd5e1]">
            Top-K
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={topK}
            onChange={(e) => setTopK(Math.max(1, Math.min(100, +e.target.value || 10)))}
            className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-4 py-2.5 text-sm text-[#f9fafb] outline-none transition focus:border-[#d4af37] focus:shadow-[0_0_16px_rgba(212,175,55,0.15)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#cbd5e1]">
            VSM Measure
          </label>
          <select
            value={measure}
            onChange={(e) => setMeasure(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-4 py-2.5 text-sm text-[#f9fafb] outline-none transition focus:border-[#d4af37]"
          >
            {MEASURES.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="self-end rounded-full border border-[#d4af37] bg-[#d4af37] px-6 py-2.5 text-sm font-semibold text-[#0b1220] shadow-[0_0_22px_rgba(212,175,55,0.25)] transition hover:border-[#f4d03f] hover:bg-[#f4d03f] disabled:opacity-50"
        >
          {loading ? "Running…" : "Run Evaluation"}
        </button>
        <button
          type="button"
          onClick={regenerate}
          disabled={loading}
          className="self-end rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-[#cbd5e1] transition hover:border-[#d4af37] hover:text-white disabled:opacity-50"
        >
          Regenerate GT
        </button>
      </section>

      {error && (
        <p className="rounded-xl border border-red-400/20 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </p>
      )}

      {report && (
        <>
          {/* ─── Global Summary ─── */}
          <GlobalSummary global={report.global} queryCount={report.query_count} topK={report.top_k} />

          {/* ─── Per-query breakdown ─── */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#f9fafb]">
              Résultats par requête ({report.query_count})
            </h2>
            {report.per_query.map((pq, i) => (
              <QueryRow
                key={pq.query}
                pq={pq}
                index={i}
                expanded={expandedQuery === i}
                onToggle={() => setExpandedQuery(expandedQuery === i ? null : i)}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════════ */

function GlobalSummary({
  global: g,
  queryCount,
  topK,
}: {
  global: Record<string, GlobalMetrics>;
  queryCount: number;
  topK: number;
}) {
  const models = Object.keys(g);
  return (
    <section className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d4af37]">
            Résumé global
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#f9fafb]">
            Moyennes — {queryCount} requête{queryCount > 1 ? "s" : ""}, top-{topK}
          </h2>
        </div>
        <WinnerBadge global={g} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {models.map((m) => (
          <div
            key={m}
            className="rounded-xl border border-white/8 border-t-4 border-t-[#d4af37] bg-[#0b1220] p-5"
          >
            <h3 className="mb-4 text-lg font-bold text-[#f9fafb]">{label(m)}</h3>
            <div className="grid grid-cols-3 gap-3">
              <MetricTile label="Avg Precision" value={g[m].avg_precision} />
              <MetricTile label="Avg Recall" value={g[m].avg_recall} />
              <MetricTile label="Avg F1" value={g[m].avg_f1} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WinnerBadge({ global: g }: { global: Record<string, GlobalMetrics> }) {
  const entries = Object.entries(g);
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => b[1].avg_f1 - a[1].avg_f1);
  if (sorted[0][1].avg_f1 === sorted[1][1].avg_f1) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#cbd5e1]">
        Égalité F1
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[#d4af37] bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#0b1220]">
      Meilleur F1 : {label(sorted[0][0])}
    </span>
  );
}

function MetricTile({ label: name, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#111827] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
        {name}
      </p>
      <p className="mt-2 text-2xl font-bold" style={{ color: barColor(value) }}>
        {pct(value)}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: pct(value), backgroundColor: barColor(value) }}
        />
      </div>
    </div>
  );
}

function QueryRow({
  pq,
  index,
  expanded,
  onToggle,
}: {
  pq: PerQueryResult;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const models = Object.keys(pq.models);
  return (
    <div className="rounded-xl border border-white/8 bg-[#111827] transition hover:border-[rgba(212,175,55,0.25)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
            Requête {index + 1}
          </p>
          <p className="mt-1 truncate text-sm font-bold text-[#f9fafb]">
            {pq.query}
          </p>
          <p className="mt-0.5 text-xs text-[#94a3b8]">
            {pq.relevant_count} doc{pq.relevant_count > 1 ? "s" : ""} pertinent{pq.relevant_count > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-4">
          {models.map((m) => (
            <ModelPill key={m} model={m} metrics={pq.models[m]} />
          ))}
          <span className="text-[#94a3b8] transition" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
            ▾
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {models.map((m) => (
              <QueryModelDetail key={m} model={m} metrics={pq.models[m]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelPill({ model, metrics }: { model: string; metrics: ModelMetrics }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/8 bg-[#0b1220] px-3 py-1.5">
      <span className="text-xs font-bold text-[#d4af37]">{label(model)}</span>
      <span className="text-xs font-semibold" style={{ color: barColor(metrics.f1) }}>
        F1 {pct(metrics.f1)}
      </span>
    </div>
  );
}

function QueryModelDetail({ model, metrics }: { model: string; metrics: ModelMetrics }) {
  return (
    <div className="rounded-lg border border-white/6 bg-[#0b1220] p-4">
      <h4 className="mb-3 text-sm font-bold text-[#d4af37]">{label(model)}</h4>
      <div className="grid grid-cols-3 gap-2">
        <MiniMetric name="Precision" value={metrics.precision} />
        <MiniMetric name="Recall" value={metrics.recall} />
        <MiniMetric name="F1" value={metrics.f1} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat name="VP" value={metrics.vp} color="#22c55e" />
        <MiniStat name="FP" value={metrics.fp} color="#ef4444" />
        <MiniStat name="FN" value={metrics.fn} color="#eab308" />
      </div>
      <p className="mt-3 text-[11px] text-[#64748b]">
        Retrieved: {metrics.retrieved_count} doc{metrics.retrieved_count > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function MiniMetric({ name, value }: { name: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">{name}</p>
      <p className="mt-1 text-lg font-bold" style={{ color: barColor(value) }}>
        {pct(value)}
      </p>
    </div>
  );
}

function MiniStat({ name, value, color }: { name: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">{name}</p>
      <p className="mt-1 text-lg font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
