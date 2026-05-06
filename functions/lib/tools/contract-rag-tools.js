// Wave 4.1 — RAG tools sobre contratos.
//
// searchContracts: embed query + kNN cosine sobre chunks (todos o filtrados por contractId).
// summarizeContract: lee chunks ordenados y pide resumen ejecutivo a Gemini Flash.
import { tool } from 'ai';
import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, generateText } from 'ai';
import { db } from '../firestore.js';
import { cosineSimilarity } from './utils/vector-math.js';
const EMBED_MODEL_ID = 'gemini-embedding-001';
const SUMMARY_MODEL_ID = 'gemini-2.5-flash';
function getGoogle() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error('GEMINI_API_KEY not set');
    return createGoogleGenerativeAI({ apiKey });
}
async function loadChunks(companyId, contractId) {
    const titles = new Map();
    const chunks = [];
    if (contractId) {
        const parentRef = db
            .collection('companies')
            .doc(companyId)
            .collection('contractEmbeddings')
            .doc(contractId);
        const parentSnap = await parentRef.get();
        titles.set(contractId, parentSnap.data()?.contractTitle ?? null);
        const snap = await parentRef.collection('chunks').get();
        for (const d of snap.docs) {
            const data = d.data();
            chunks.push({
                contractId,
                chunkIndex: typeof data.chunkIndex === 'number' ? data.chunkIndex : 0,
                text: typeof data.text === 'string' ? data.text : '',
                embedding: Array.isArray(data.embedding) ? data.embedding : [],
            });
        }
        return { chunks, titles };
    }
    const parents = await db
        .collection('companies')
        .doc(companyId)
        .collection('contractEmbeddings')
        .get();
    for (const p of parents.docs) {
        titles.set(p.id, p.data()?.contractTitle ?? null);
    }
    // Lee todos los chunks con un collectionGroup-style traversal por padre.
    const subSnaps = await Promise.all(parents.docs.map((p) => p.ref.collection('chunks').get()));
    for (let i = 0; i < parents.docs.length; i++) {
        const cid = parents.docs[i].id;
        for (const d of subSnaps[i].docs) {
            const data = d.data();
            chunks.push({
                contractId: cid,
                chunkIndex: typeof data.chunkIndex === 'number' ? data.chunkIndex : 0,
                text: typeof data.text === 'string' ? data.text : '',
                embedding: Array.isArray(data.embedding) ? data.embedding : [],
            });
        }
    }
    return { chunks, titles };
}
export function createContractRagTools(companyId) {
    return {
        searchContracts: tool({
            description: 'Busca pasajes relevantes en los contratos indexados (RAG semántico). Devuelve top K chunks con score de similitud. Úsalo para responder preguntas sobre cláusulas, condiciones, salarios o detalles específicos. Cita siempre el contractId y chunkIndex en la respuesta.',
            parameters: z.object({
                query: z.string().describe('Pregunta o término a buscar en los contratos'),
                contractId: z
                    .string()
                    .optional()
                    .describe('Si se provee, limita la búsqueda a un contrato específico'),
                topK: z.number().optional().default(5).describe('Cantidad de resultados (default 5)'),
            }),
            execute: async ({ query, contractId, topK = 5 }) => {
                try {
                    const { chunks, titles } = await loadChunks(companyId, contractId);
                    if (chunks.length === 0) {
                        return { count: 0, results: [], note: 'No hay contratos indexados.' };
                    }
                    const google = getGoogle();
                    const { embedding } = await embed({
                        model: google.textEmbeddingModel(EMBED_MODEL_ID),
                        value: query,
                    });
                    const scored = chunks
                        .filter((c) => c.embedding.length > 0)
                        .map((c) => ({
                        ...c,
                        score: cosineSimilarity(embedding, c.embedding),
                        contractTitle: titles.get(c.contractId) ?? null,
                    }));
                    scored.sort((a, b) => b.score - a.score);
                    const top = scored.slice(0, Math.max(1, topK));
                    return {
                        count: top.length,
                        results: top.map((r) => ({
                            contractId: r.contractId,
                            contractTitle: r.contractTitle,
                            chunkIndex: r.chunkIndex,
                            text: r.text,
                            score: Number(r.score.toFixed(4)),
                        })),
                    };
                }
                catch (error) {
                    return {
                        count: 0,
                        results: [],
                        error: error instanceof Error ? error.message : 'unknown error',
                    };
                }
            },
        }),
        summarizeContract: tool({
            description: 'Resume un contrato indexado en 5 viñetas. Útil cuando el usuario pide un resumen completo en vez de buscar una cláusula puntual.',
            parameters: z.object({
                contractId: z.string().describe('ID del contrato a resumir'),
            }),
            execute: async ({ contractId }) => {
                try {
                    const { chunks, titles } = await loadChunks(companyId, contractId);
                    if (chunks.length === 0) {
                        return { contractId, summary: null, note: 'Contrato no indexado o vacío.' };
                    }
                    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
                    const fullText = chunks.map((c) => c.text).join('\n\n');
                    const google = getGoogle();
                    const { text } = await generateText({
                        model: google(SUMMARY_MODEL_ID),
                        prompt: `Resume el siguiente contrato en exactamente 5 viñetas claras y concretas. Cada viñeta debe cubrir un aspecto crítico (partes, objeto, vigencia, remuneración, obligaciones especiales o cláusulas inusuales). Responde en español.\n\nCONTRATO:\n${fullText}`,
                    });
                    return {
                        contractId,
                        contractTitle: titles.get(contractId) ?? null,
                        summary: text.trim(),
                        chunkCount: chunks.length,
                    };
                }
                catch (error) {
                    return {
                        contractId,
                        summary: null,
                        error: error instanceof Error ? error.message : 'unknown error',
                    };
                }
            },
        }),
    };
}
//# sourceMappingURL=contract-rag-tools.js.map