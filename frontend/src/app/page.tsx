"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import MeasureSelector from "@/components/MeasureSelector";
import ModelSelector from "@/components/ModelSelector";
import SearchBar from "@/components/SearchBar";
import type { SearchModel, VsmMeasure } from "@/lib/api";

type Draft = { query: string; model: SearchModel; measure: VsmMeasure };
const DEFAULT_DRAFT: Draft = { query: "", model: "vsm", measure: "cosine" };
function supportsMeasure(m: SearchModel) { return m === "vsm"; }
function getModelLabel(m: SearchModel) { return m === "bir" ? "Probabilistic (BIR)" : "Vector Space Model"; }

export default function HomePage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"search" | "compare">("search");
  const [query, setQuery] = useState("");
  const [model, setModel] = useState<SearchModel>("vsm");
  const [measure, setMeasure] = useState<VsmMeasure>("cosine");
  const [compareLeft, setCompareLeft] = useState<Draft>({ ...DEFAULT_DRAFT, model: "vsm" });
  const [compareRight, setCompareRight] = useState<Draft>({ ...DEFAULT_DRAFT, model: "bir" });

  const openCompareMode = () => {
    setCompareLeft({ query, model, measure });
    const rm: SearchModel = model === "vsm" ? "bir" : "vsm";
    setCompareRight({ query, model: rm, measure: rm === "vsm" ? measure : "cosine" });
    setViewMode("compare");
  };

  const runSearch = () => {
    if (!query.trim()) return;
    router.push(`/results?${new URLSearchParams({ q: query.trim(), model, measure }).toString()}`);
  };

  const runCompare = () => {
    if (!compareLeft.query.trim() || !compareRight.query.trim()) return;
    router.push(`/results?${new URLSearchParams({ mode: "compare", queryA: compareLeft.query.trim(), modelA: compareLeft.model, measureA: compareLeft.measure, queryB: compareRight.query.trim(), modelB: compareRight.model, measureB: compareRight.measure }).toString()}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="space-y-5 rounded-2xl bg-[linear-gradient(135deg,rgba(11,18,32,0.96),rgba(17,24,39,0.9))] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:px-8 md:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d4af37]">Projet academique RI</p>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-[#f9fafb] md:text-5xl">Moteur de Recherche</h1>
            <p className="max-w-2xl text-base leading-7 text-[#cbd5e1]">Index inverse, TF-IDF, VSM et BIR probabiliste (Robertson–Spärck Jones).</p>
          </div>
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <button type="button" onClick={() => setViewMode("search")} className={viewMode === "search" ? "rounded-full bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#0b1220] shadow-[0_0_18px_rgba(212,175,55,0.25)]" : "rounded-full px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:text-white"}>Search</button>
            <button type="button" onClick={openCompareMode} className={viewMode === "compare" ? "rounded-full bg-[#d4af37] px-4 py-2 text-sm font-semibold text-[#0b1220] shadow-[0_0_18px_rgba(212,175,55,0.25)]" : "rounded-full px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:text-white"}>Compare</button>
          </div>
        </div>
      </section>

      {viewMode === "search" ? (
        <>
          <section className="space-y-5 rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <SearchBar query={query} setQuery={setQuery} onSearch={runSearch} />
            <div className="grid gap-4 md:grid-cols-2">
              <ModelSelector model={model} onChange={setModel} />
              {supportsMeasure(model) && <MeasureSelector measure={measure} onChange={setMeasure} />}
            </div>
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            {([["VSM", "Vecteurs TF-IDF et similarite cosinus, Dice, Jaccard, Overlap."], ["BIR", "Robertson–Spärck Jones. Classement par log-odds de pertinence (PRP)."]] as const).map(([title, text]) => (
              <div key={title} className="rounded-xl border border-[rgba(212,175,55,0.2)] border-t-4 border-t-[#d4af37] bg-[#111827] p-5 shadow-[0_16px_42px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                <h2 className="font-bold text-[#f9fafb]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#cbd5e1]">{text}</p>
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="space-y-6 rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[#111827] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d4af37]">Compare Mode</p>
              <h2 className="mt-1 text-2xl font-black text-[#f9fafb]">VSM vs BIR</h2>
              <p className="mt-2 text-sm leading-6 text-[#cbd5e1]">Compare both retrieval models side by side.</p>
            </div>
            <button type="button" onClick={() => setViewMode("search")} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:border-[#d4af37] hover:text-[#f9fafb]">Back</button>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <CompareDraftCard title="Model A" draft={compareLeft} onChange={(p) => setCompareLeft((c) => ({ ...c, ...p }))} />
            <CompareDraftCard title="Model B" draft={compareRight} onChange={(p) => setCompareRight((c) => ({ ...c, ...p }))} />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={runCompare} className="rounded-full border border-[#d4af37] bg-[#d4af37] px-6 py-3 text-sm font-semibold text-[#0b1220] shadow-[0_0_22px_rgba(212,175,55,0.25)] transition hover:border-[#f4d03f] hover:bg-[#f4d03f]">Compare</button>
          </div>
        </section>
      )}
    </div>
  );
}

function CompareDraftCard({ title, draft, onChange }: { title: string; draft: Draft; onChange: (p: Partial<Draft>) => void }) {
  return (
    <section className="rounded-xl border border-[rgba(212,175,55,0.18)] border-t-4 border-t-[#d4af37] bg-[#111827] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.26)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h3 className="text-lg font-bold text-[#f9fafb]">{title}</h3><p className="text-sm text-[#cbd5e1]">{getModelLabel(draft.model)}</p></div>
        <span className="rounded-full border border-[#d4af37]/25 bg-[#0b1220] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#f9fafb]">{title}</span>
      </div>
      <div className="space-y-4">
        <SearchBar query={draft.query} setQuery={(v) => onChange({ query: v })} onSearch={() => undefined} hideSubmitButton />
        <div className="grid gap-4">
          <ModelSelector model={draft.model} onChange={(model) => onChange({ model })} />
          {supportsMeasure(draft.model) && <MeasureSelector measure={draft.measure} onChange={(measure) => onChange({ measure })} />}
        </div>
      </div>
    </section>
  );
}
