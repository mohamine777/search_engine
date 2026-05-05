import { Suspense } from "react";
import EvaluationClient from "./EvaluationClient";

export const metadata = { title: "Évaluation – Moteur de Recherche RI" };

export default function EvaluationPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-[#cbd5e1]">Chargement…</p>}>
      <EvaluationClient />
    </Suspense>
  );
}
