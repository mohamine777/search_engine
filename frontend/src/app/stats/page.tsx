"use client";

import { useEffect, useState } from "react";

import { fetchStats, fetchTfidfTable, type CorpusStats, type TfidfTable } from "@/lib/api";

export default function StatsPage() {
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [tfidf, setTfidf] = useState<TfidfTable | null>(null);
  const [view, setView] = useState<"top" | "full">("top");

  useEffect(() => {
    void fetchStats().then(setStats).catch(() => setStats(null));
    void fetchTfidfTable().then(setTfidf).catch(() => setTfidf(null));
  }, []);

  const fullTerms = tfidf?.terms ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d4af37]">Corpus</p>
        <h1 className="mt-1 text-3xl font-black text-[#f9fafb]">Statistiques de l&apos;index</h1>
      </div>

      {/* ── Summary cards ──────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Documents" value={stats?.documents ?? 0} />
        <StatCard label="Termes uniques" value={stats?.terms ?? 0} />
        <StatCard label="Taille postings" value={stats?.index_size ?? 0} />
        <StatCard label="Termes (TF×IDF)" value={tfidf?.total_terms ?? 0} />
      </section>

      {/* ── View toggle ────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setView("top")}
            className={
              view === "top"
                ? "rounded-full bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#0b1220] shadow-[0_0_18px_rgba(212,175,55,0.25)]"
                : "rounded-full px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:text-white"
            }
          >
            Top 15 termes
          </button>
          <button
            type="button"
            onClick={() => setView("full")}
            className={
              view === "full"
                ? "rounded-full bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#0b1220] shadow-[0_0_18px_rgba(212,175,55,0.25)]"
                : "rounded-full px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:text-white"
            }
          >
            Table TF×IDF complète ({fullTerms.length})
          </button>
        </div>
      </div>

      {/* ── Top terms table (existing + tf_idf column) ─────────── */}
      {view === "top" && (
        <section className="rounded-xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <h2 className="font-bold text-[#f9fafb]">Top termes</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#cbd5e1]">
                <tr>
                  <th className="py-2">#</th>
                  <th className="py-2">Terme</th>
                  <th className="py-2 text-right">TF</th>
                  <th className="py-2 text-right">DF</th>
                  <th className="py-2 text-right">IDF</th>
                  <th className="py-2 text-right font-bold text-[#d4af37]">TF × IDF</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.top_terms || []).map((term, i) => (
                  <tr key={term.term} className="border-t border-white/8 transition hover:bg-white/[0.03]">
                    <td className="py-3 text-[#cbd5e1]">{i + 1}</td>
                    <td className="py-3 font-semibold text-[#f9fafb]">{term.term}</td>
                    <td className="py-3 text-right tabular-nums">{term.tf}</td>
                    <td className="py-3 text-right tabular-nums">{term.df}</td>
                    <td className="py-3 text-right tabular-nums">{term.idf.toFixed(4)}</td>
                    <td className="py-3 text-right tabular-nums font-semibold text-[#d4af37]">{term.tf_idf.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Full TF×IDF ranked table ───────────────────────────── */}
      {view === "full" && (
        <section className="rounded-xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#f9fafb]">Table TF × IDF complète</h2>
              <p className="mt-1 text-sm text-[#cbd5e1]">{fullTerms.length} termes — triés par TF×IDF décroissant</p>
            </div>
            <span className="rounded-full border border-[#d4af37]/25 bg-[#0b1220] px-3 py-1 text-xs font-semibold text-[#f9fafb]">
              {tfidf?.documents ?? 0} docs
            </span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#111827] text-[#cbd5e1]">
                <tr>
                  <th className="py-2">#</th>
                  <th className="py-2">Terme</th>
                  <th className="py-2 text-right">TF</th>
                  <th className="py-2 text-right">DF</th>
                  <th className="py-2 text-right">IDF</th>
                  <th className="py-2 text-right font-bold text-[#d4af37]">TF × IDF</th>
                </tr>
              </thead>
              <tbody>
                {fullTerms.map((entry, i) => (
                  <tr key={entry.term} className="border-t border-white/8 transition hover:bg-white/[0.03]">
                    <td className="py-2.5 text-[#cbd5e1]">{i + 1}</td>
                    <td className="py-2.5 font-semibold text-[#f9fafb]">{entry.term}</td>
                    <td className="py-2.5 text-right tabular-nums">{entry.tf}</td>
                    <td className="py-2.5 text-right tabular-nums">{entry.df}</td>
                    <td className="py-2.5 text-right tabular-nums">{entry.idf.toFixed(4)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-[#d4af37]">{entry.tf_idf.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-5 shadow-[0_16px_42px_rgba(0,0,0,0.24)]">
      <p className="text-sm font-semibold text-[#cbd5e1]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#f9fafb]">{value}</p>
    </div>
  );
}
