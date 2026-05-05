"""Quick integration test for the /evaluate endpoint."""
import requests
import json

r = requests.post("http://localhost:8000/evaluate", json={"top_k": 10, "measure": "cosine"})
data = r.json()
print("Status:", r.status_code)
print("Queries:", data["query_count"])
print("Top-K:", data["top_k"])
print()
print("=== GLOBAL SUMMARY ===")
for model, metrics in data["global"].items():
    print(f"  {model}: P={metrics['avg_precision']:.4f}  R={metrics['avg_recall']:.4f}  F1={metrics['avg_f1']:.4f}")
print()
print("=== PER-QUERY (first 4) ===")
for pq in data["per_query"][:4]:
    print(f'Query: "{pq["query"]}" ({pq["relevant_count"]} relevant)')
    for m, met in pq["models"].items():
        print(f"  {m}: P={met['precision']} R={met['recall']} F1={met['f1']} VP={met['vp']} FP={met['fp']} FN={met['fn']}")
    print()
