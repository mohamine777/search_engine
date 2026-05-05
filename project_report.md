# Information Retrieval Search Engine — Project Report

---

## 1. General Idea

### 1.1 What the System Does

This project implements a complete **Information Retrieval (IR) system** — commonly known as a search engine — designed to process a collection of text documents and retrieve the most relevant ones in response to a user's query. Given a natural-language question or set of keywords, the system analyses every document in its corpus, assigns a numerical relevance score to each, and returns a ranked list with the most pertinent documents appearing first.

### 1.2 Why Information Retrieval Matters

The volume of textual information produced in academic, scientific, and professional environments has grown far beyond what any individual can manually inspect. Information Retrieval provides the theoretical and practical tools to bridge the gap between a user's information need and the vast body of available documents. Without effective retrieval mechanisms, valuable knowledge remains buried — inaccessible not because it does not exist, but because it cannot be found in time.

IR is a foundational discipline of computer science that underpins web search engines, digital library systems, enterprise knowledge bases, and scientific literature databases. Mastering its core models is essential for any student or practitioner working with large-scale textual data.

### 1.3 The Problem It Solves

The fundamental challenge addressed by this system is **relevance ranking**: given a query composed of one or more terms, how should documents be ordered so that the ones most likely to satisfy the user's information need appear at the top of the list? Different retrieval models answer this question through different theoretical lenses — geometric, probabilistic, and statistical — and this project implements and compares three such approaches.

---

## 2. System Architecture

The system follows a classical IR pipeline, composed of four major stages: document collection, indexing, query processing, and ranking.

### 2.1 Document Collection

The corpus is the foundation of any retrieval system. In this project, users may provide documents in plain-text or PDF format. Each document is read, its raw textual content is extracted, and it is assigned a unique identifier within the system. The collection can be extended at any time by uploading additional files, and the index is updated accordingly.

### 2.2 Indexing Process — The Inverted Index

Once a document's text has been extracted, it passes through a **preprocessing pipeline** that performs the following operations:

- **Tokenisation**: the text is split into individual words (tokens).
- **Case normalisation**: all tokens are converted to lowercase to ensure case-insensitive matching.
- **Stop-word removal**: common function words (such as *the*, *is*, *and*, *of*) that carry little discriminative value are discarded.
- **Stemming**: each remaining token is reduced to its root form. For example, *retrieval*, *retrieving*, and *retrieved* are all reduced to the stem *retriev*. This allows the system to match morphological variants of the same concept.

The output of preprocessing is a list of **stems** (normalised terms) for each document. These are then organised into an **inverted index** — the central data structure of any IR system. An inverted index maps each term in the vocabulary to the list of documents in which it appears, together with the frequency of occurrence in each document. This structure allows the system to answer the question *"In which documents does term t appear, and how often?"* in constant time, making retrieval efficient even for large corpora.

In addition to the inverted index, the system precomputes and stores several statistical measures for each term: its **total frequency** across the corpus, its **document frequency**, its **inverse document frequency**, and its **TF × IDF weight**. These quantities are used by the retrieval models described in Section 3.

### 2.3 Query Processing

When the user submits a query, it undergoes the exact same preprocessing steps as the documents — tokenisation, lowercasing, stop-word removal, and stemming. This guarantees that query terms and document terms are represented in the same vocabulary space, enabling accurate matching. The preprocessed query is then passed to the selected retrieval model for scoring.

### 2.4 Ranking System

The ranking component applies one of the implemented retrieval models to compute a **Retrieval Status Value (RSV)** for every document in the corpus with respect to the given query. Documents are then sorted in descending order of their RSV, and the top results are returned to the user along with metadata, relevance scores, and text snippets highlighting the matched terms.

---

## 3. Retrieval Models Used

This project implements two complementary retrieval models — the Vector Space Model and the Binary Independence Retrieval model — and uses TF-IDF weighting as the statistical foundation shared across both.

### 3.1 Vector Space Model (VSM)

#### Concept

The Vector Space Model, introduced by Gerard Salton in the 1970s as part of the SMART system at Cornell University, represents both documents and queries as vectors in a high-dimensional term space. Each dimension of this space corresponds to a unique term in the vocabulary, and the value along that dimension reflects the importance (weight) of the term within the document or query.

For example, in a vocabulary of three terms — *retrieval*, *probability*, *vector* — a document that discusses retrieval and vectors but not probability might be represented as the vector (0.85, 0.00, 0.72), while a query about probabilistic retrieval might be (0.60, 0.90, 0.00).

#### Term Weighting

The weight assigned to each term in a document vector is computed using the **TF-IDF** scheme (described in detail in Section 3.3). The term frequency captures how prominently a term features within a given document, while the inverse document frequency captures how discriminative the term is across the entire corpus.

#### Similarity Measurement

Once documents and queries are represented as weighted vectors, their similarity is measured geometrically. The most widely used measure is the **cosine similarity**, which computes the cosine of the angle between two vectors. Two vectors pointing in the same direction (angle close to zero) are considered highly similar, regardless of their magnitude. This property is desirable because it prevents long documents from being systematically favoured over short ones simply because they contain more term occurrences.

The system also supports additional similarity measures from the literature:

- **Inner product (scalar product)**: the raw dot product of the two vectors, which rewards both alignment and magnitude.
- **Euclidean distance**: measures the straight-line distance between two vector endpoints; smaller distances indicate higher similarity.
- **Dice coefficient**: a set-similarity measure that emphasises shared terms relative to the total weight of both vectors.
- **Jaccard coefficient**: similar to Dice but with a different normalisation that penalises non-overlapping terms more strongly.
- **Overlap coefficient**: measures the degree to which the smaller vector is contained within the larger one.

These alternatives allow the user to explore how different geometric interpretations of similarity affect the retrieval ranking.

### 3.2 Binary Independence Retrieval (BIR)

#### Concept

The Binary Independence Retrieval model, proposed by Robertson and Spärck Jones in 1976, approaches retrieval from a fundamentally different perspective: **probability theory**. Rather than measuring geometric similarity, the BIR model estimates the probability that a document is relevant to a given query and ranks documents by decreasing probability of relevance. This principle is known as the **Probabilistic Ranking Principle (PRP)**.

#### Binary Independence Assumption

The model operates under two simplifying assumptions:

1. **Binary term representation**: each term is modelled as either *present* or *absent* in a document. The exact frequency of a term within a document is not considered — only whether the term occurs at all.

2. **Term independence**: the presence or absence of one term in a document is assumed to be statistically independent of the presence or absence of any other term. While this assumption is rarely true in natural language (e.g., *information* and *retrieval* tend to co-occur), it greatly simplifies the mathematical framework and has been shown to produce effective rankings in practice.

#### Relevance Estimation

For each query term *t*, the model estimates two quantities:

- **p_t**: the probability that term *t* appears in a document that is relevant to the query.
- **q_t**: the probability that term *t* appears in a document that is *not* relevant to the query.

The **Retrieval Status Value** for a document is then computed as the sum, over all query terms present in the document, of the log-odds ratio:

> RSV(d, q) = Σ log [ p_t · (1 − q_t) ] / [ q_t · (1 − p_t) ]

A term receives a high weight when it is likely to appear in relevant documents (high p_t) and unlikely to appear in non-relevant documents (low q_t). Conversely, a term that appears indiscriminately across relevant and non-relevant documents contributes little to the ranking.

#### Parameter Estimation Without Relevance Feedback

When no prior relevance judgements are available — which is the typical situation for a new query — the model falls back to a well-known simplification. It assumes that every query term is equally likely to appear in relevant documents (p_t = 0.5) and estimates q_t from the corpus-wide document frequency of the term:

> c_t = log [ (N − n_t + 0.5) / (n_t + 0.5) ]

where N is the total number of documents in the corpus and n_t is the number of documents containing term *t*. The additive constant of 0.5 is a **Laplace smoothing** factor that prevents the logarithm from encountering zero or undefined values when a term appears in all or no documents.

This simplified formula can be understood intuitively: a term that appears in very few documents (low n_t relative to N) receives a high weight because its presence in a document is a strong signal of relevance. A term that appears in most documents receives a weight close to zero — or even negative — because it lacks discriminative power.

#### Parameter Estimation With Relevance Feedback

When relevance judgements are available — for example, when a user marks certain retrieved documents as relevant — the model uses the full estimation formula with four parameters: the number of relevant documents (R), the number of relevant documents containing the term (r_t), the total number of documents containing the term (n_t), and the corpus size (N). All four components are smoothed with a +0.5 additive correction, producing a more refined estimate that adapts to the specific query.

### 3.3 TF-IDF Analysis

TF-IDF is not a retrieval model in itself but rather a **term-weighting scheme** that quantifies how important a term is to a document within the context of a corpus. It serves as the foundation for vector construction in the VSM and provides a statistical lens through which the entire vocabulary can be analysed.

#### Term Frequency (TF)

The term frequency of a term *t* in a document *d* is the number of times *t* occurs in *d*. A higher count suggests that the term is more central to the document's content. In this system, term frequencies may be normalised by dividing by the maximum frequency of any term in the document, which prevents longer documents from having systematically larger weights.

#### Document Frequency (DF)

The document frequency of a term *t* is the number of documents in the corpus that contain at least one occurrence of *t*. DF measures how widespread a term is. A term with a high document frequency appears in many documents and is therefore less useful for distinguishing one document from another.

#### Inverse Document Frequency (IDF)

The inverse document frequency is defined as the logarithm of the ratio of the total number of documents N to the document frequency of the term:

> IDF(t) = log(N / DF(t))

The logarithm ensures that IDF grows slowly as the term becomes rarer, preventing extremely rare terms from dominating the ranking. IDF is high for terms that appear in few documents (they are discriminative) and low for terms that appear in many documents (they are common).

#### TF × IDF — The Combined Weight

The product TF × IDF combines local importance (how prominent a term is within a specific document) with global discriminative power (how rare the term is across the corpus). This product is the standard weight used in the VSM for constructing document and query vectors.

The system computes and displays TF × IDF for every term in the vocabulary, enabling users to inspect which terms carry the most weight in the corpus and to understand why certain documents rank higher than others for a given query.

---

## 4. Query Processing Flow

The complete query processing pipeline can be summarised in the following sequence of steps:

1. **Query submission**: the user enters a free-text query consisting of one or more keywords or a natural-language phrase, and selects a retrieval model (VSM or BIR).

2. **Preprocessing**: the query undergoes the same normalisation pipeline as indexed documents — tokenisation, lowercasing, stop-word removal, and stemming — producing a set of query stems.

3. **Index lookup**: for each query stem, the system consults the inverted index to identify which documents contain the term and with what frequency.

4. **Score computation**: depending on the selected model:
   - In the **VSM**, the query is represented as a TF-IDF weighted vector, and its similarity to every document vector is computed using the chosen similarity measure (e.g., cosine).
   - In the **BIR** model, the Robertson-Spärck Jones weight is computed for each query term, and the RSV of each document is calculated as the sum of weights for the query terms it contains.

5. **Ranking**: documents are sorted in descending order of their computed score.

6. **Presentation**: the top-ranked documents are returned to the user, each accompanied by its title, relevance score, and a text snippet in which the matched query terms are highlighted.

---

## 5. Comparison of Models

The three approaches implemented in this system — VSM, BIR, and TF-IDF weighting — represent distinct theoretical perspectives on the retrieval problem.

| Aspect | VSM | BIR | TF-IDF |
|--------|-----|-----|--------|
| **Nature** | Geometric model | Probabilistic model | Weighting scheme |
| **Foundation** | Linear algebra, vector spaces | Probability theory, Bayes' theorem | Corpus statistics |
| **Document representation** | Weighted real-valued vector | Binary presence/absence per term | Weight per term |
| **Query representation** | Weighted real-valued vector | Set of weighted terms | Weight per term |
| **Scoring principle** | Similarity between vectors | Log-odds of relevance | Not a ranking function |
| **Similarity/scoring** | Cosine, inner product, Dice, etc. | Sum of log-odds weights | Provides weights to VSM |
| **Handles term frequency** | Yes, via TF-IDF weights | No — binary model | Yes, directly |
| **Handles rare vs. common terms** | Yes, via IDF component | Yes, via corpus frequency estimates | Yes, via IDF |
| **Strengths** | Intuitive geometric interpretation; multiple similarity measures; partial matching | Principled probabilistic foundation; adapts with relevance feedback | Simple, effective, widely used foundation for other models |
| **Limitations** | Assumes term independence implicitly; no probabilistic interpretation | Ignores within-document term frequency; binary simplification | Not a complete retrieval model; must be paired with a ranking function |

The **VSM** excels when a user wants to explore different notions of geometric similarity and when within-document term frequency is informative. The **BIR** model is most valuable when the goal is to estimate relevance probability directly, especially when relevance feedback is available. **TF-IDF** serves as the common statistical language that both models draw upon — it provides the weights for VSM vectors and mirrors the corpus-frequency estimates used in BIR's simplified formula.

By offering both models side by side, with a built-in comparison mode, the system enables users to observe how the same query can produce different rankings depending on the theoretical assumptions underlying each model.

---

## 6. Final Goal of the System

The overarching goal of this project is threefold:

### 6.1 Improving Search Relevance

The system aims to return documents that genuinely satisfy the user's information need, not merely documents that happen to share surface-level keywords with the query. By employing principled weighting schemes (TF-IDF) and distinct ranking strategies (VSM and BIR), the system maximises the likelihood that the most relevant documents appear at the top of the results list.

### 6.2 Ranking the Best Documents First

In any practical retrieval scenario, the user examines only the first few results. The effectiveness of the system therefore depends on its ability to place the most relevant documents in the highest-ranking positions. Both the VSM and BIR models are designed with this objective in mind: the cosine similarity in VSM favours documents whose term distribution closely matches the query, while the probabilistic log-odds in BIR directly optimise for the probability of relevance.

### 6.3 Bridging Classical IR Theory and Practical Implementation

This project demonstrates that the foundational models of Information Retrieval — originally developed as mathematical abstractions in academic research — can be implemented as a fully functional, interactive search engine with a modern web interface. The Vector Space Model, the Probabilistic Ranking Principle, and TF-IDF weighting are not merely theoretical constructs; they are practical tools that, when correctly implemented, produce effective and interpretable retrieval results.

By combining a Python-based backend for indexing and retrieval with a responsive web frontend for querying and result exploration, the system serves as both a **learning tool** — enabling students and researchers to observe how different models behave on the same corpus — and a **practical demonstration** of classical IR principles applied to real document collections.

---

*This report describes the design and theoretical foundations of an Information Retrieval system implementing the Vector Space Model, the Binary Independence Retrieval model, and TF-IDF term weighting. The system was developed as an academic project in the field of Information Retrieval.*
