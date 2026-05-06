// Wave 4.1 — Cosine similarity puro para kNN sobre embeddings.
// Sin libs externas: arrays planos number[].
export function cosineSimilarity(a, b) {
    const len = Math.min(a.length, b.length);
    if (len === 0)
        return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < len; i++) {
        const x = a[i];
        const y = b[i];
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    if (na === 0 || nb === 0)
        return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
//# sourceMappingURL=vector-math.js.map