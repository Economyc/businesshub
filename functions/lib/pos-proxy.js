import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
const posToken = defineSecret('POS_TOKEN');
const POS_BASE_URL = 'http://api.restaurant.pe/restaurant';
const POS_DOMAIN_ID = '8267';
function buildUrl(path, token) {
    return `${POS_BASE_URL}${path}?token=${token.trim()}`;
}
async function fetchPosApi(url, method = 'GET', body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body && method === 'POST') {
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`POS API error ${res.status}: ${text}`);
    }
    return res.json();
}
const BATCH_DELAY = 6000; // 6s between API requests (5s cooldown)
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRateLimited(response) {
    const msg = (response.mensajes || []).join(' ').toLowerCase();
    return msg.includes('solicitud en ejecuci') || msg.includes('espere');
}
function extractVentas(response) {
    const d = response.data;
    if (Array.isArray(d))
        return d;
    if (d && typeof d === 'object')
        return Object.values(d);
    return [];
}
async function fetchAllPagesForLocal(token, endpointPath, localId, f1, f2, needsDelay) {
    const ventas = [];
    let pagina = 1;
    let requestCount = 0;
    while (true) {
        if (needsDelay || pagina > 1) {
            await delay(BATCH_DELAY);
        }
        const url = buildUrl(endpointPath, token);
        const response = (await fetchPosApi(url, 'POST', {
            local_id: localId, f1, f2, pagina,
        }));
        requestCount++;
        const tipo = Number(response.tipo);
        if (tipo !== 1) {
            if (isRateLimited(response)) {
                return { ventas, rateLimited: true, requestCount };
            }
            // Non-rate-limit error on first page: propagate so caller can decide to fallback
            if (pagina === 1) {
                const msg = (response.mensajes || []).join(', ') || `POS error tipo ${tipo}`;
                throw new Error(msg);
            }
            // Error on later pages: stop pagination for this local, keep what we have
            break;
        }
        const pageVentas = extractVentas(response);
        if (pageVentas.length === 0)
            break;
        ventas.push(...pageVentas);
        pagina++;
    }
    return { ventas, rateLimited: false, requestCount };
}
// Try multiple candidate endpoints to find one that returns Notas de Venta
const VENTA_ENDPOINTS = [
    { path: `/readonly/rest/venta/obtenerVentas/${POS_DOMAIN_ID}`, name: 'obtenerVentas' },
    { path: `/readonly/rest/venta/obtenerVentasPorFecha/${POS_DOMAIN_ID}`, name: 'obtenerVentasPorFecha' },
    { path: `/readonly/rest/venta/obtenerVentasPorLocal/${POS_DOMAIN_ID}`, name: 'obtenerVentasPorLocal' },
    { path: `/readonly/rest/venta/listarVentas/${POS_DOMAIN_ID}`, name: 'listarVentas' },
    { path: `/readonly/rest/venta/obtenerVentasTodas/${POS_DOMAIN_ID}`, name: 'obtenerVentasTodas' },
];
async function probeEndpoints(token, localId, f1, f2) {
    for (const ep of VENTA_ENDPOINTS) {
        try {
            const url = buildUrl(ep.path, token);
            const response = (await fetchPosApi(url, 'POST', {
                local_id: localId, f1, f2, pagina: 1,
            }));
            const tipo = Number(response.tipo);
            if (tipo === 1) {
                const ventas = extractVentas(response);
                // Log what document types this endpoint returns
                const tipos = ventas.map((v) => v.tipo_documento).filter(Boolean);
                const uniqueTipos = [...new Set(tipos)];
                console.log(`[PROBE] ${ep.name} => SUCCESS, ${ventas.length} ventas, tipos: [${uniqueTipos.join(', ')}]`);
                return ep;
            }
            if (isRateLimited(response)) {
                console.log(`[PROBE] ${ep.name} => RATE LIMITED`);
                return null; // can't probe further, stop
            }
            console.log(`[PROBE] ${ep.name} => tipo=${tipo}, msgs: ${(response.mensajes || []).join(', ')}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(`[PROBE] ${ep.name} => FAILED: ${msg}`);
        }
    }
    return null;
}
async function fetchVentasBatch(token, localIds, f1, f2) {
    const integrationPath = `/readonly/rest/venta/obtenerVentasPorIntegracion/${POS_DOMAIN_ID}`;
    // Probe alternative endpoints to find one with Notas de Venta
    console.log('[BATCH] Probing alternative endpoints...');
    const found = await probeEndpoints(token, localIds[0], f1, f2);
    let endpointPath;
    let endpointUsed;
    if (found) {
        endpointPath = found.path;
        endpointUsed = found.name;
        console.log(`[BATCH] Using discovered endpoint: ${endpointUsed}`);
        // First local was already fetched during probe, but we re-fetch for consistency
        // (probe only fetched page 1; we need all pages)
    }
    else {
        endpointPath = integrationPath;
        endpointUsed = 'obtenerVentasPorIntegracion';
        console.log(`[BATCH] No alternative found, using: ${endpointUsed}`);
    }
    // Now fetch all locals with the chosen endpoint
    // If we probed (used a request), add delay before next request
    const allVentas = [];
    for (let i = 0; i < localIds.length; i++) {
        const needsDelay = i > 0 || found !== null; // delay if not first, or if probe already made requests
        const result = await fetchAllPagesForLocal(token, endpointPath, localIds[i], f1, f2, needsDelay);
        allVentas.push(...result.ventas);
        if (result.rateLimited) {
            return { ventas: allVentas, rateLimited: true, endpoint: endpointUsed };
        }
    }
    return { ventas: allVentas, rateLimited: false, endpoint: endpointUsed };
}
export const posProxy = onRequest({
    cors: true,
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [posToken],
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { action, params } = req.body;
        const token = posToken.value();
        if (!action) {
            res.status(400).json({ error: 'action is required' });
            return;
        }
        let data;
        switch (action) {
            case 'dominio': {
                const url = buildUrl(`/readonly/rest/delivery/obtenerInformacionDominio/${POS_DOMAIN_ID}`, token);
                data = await fetchPosApi(url);
                break;
            }
            case 'ventas': {
                if (!params?.local_id || !params?.f1 || !params?.f2) {
                    res.status(400).json({ error: 'ventas requires local_id, f1, f2' });
                    return;
                }
                const url = buildUrl(`/readonly/rest/venta/obtenerVentasPorIntegracion/${POS_DOMAIN_ID}`, token);
                data = await fetchPosApi(url, 'POST', {
                    pagina: params.pagina ?? 1,
                    local_id: params.local_id,
                    f1: params.f1,
                    f2: params.f2,
                });
                break;
            }
            case 'ventas-batch': {
                if (!params?.local_ids?.length || !params?.f1 || !params?.f2) {
                    res.status(400).json({ error: 'ventas-batch requires local_ids (array), f1, f2' });
                    return;
                }
                const batchResult = await fetchVentasBatch(token, params.local_ids, params.f1, params.f2);
                res.json({ success: true, data: batchResult });
                return;
            }
            case 'probe': {
                // Test a single endpoint and return raw response for debugging
                if (!params?.endpoint_path || !params?.local_id || !params?.f1 || !params?.f2) {
                    res.status(400).json({ error: 'probe requires endpoint_path, local_id, f1, f2' });
                    return;
                }
                const { endpoint_path: _ep, ...extraParams } = params;
                try {
                    const url = buildUrl(params.endpoint_path, token);
                    const body = { local_id: params.local_id, f1: params.f1, f2: params.f2, pagina: params.pagina ?? 1, ...extraParams };
                    delete body.endpoint_path;
                    delete body.local_ids;
                    const rawResponse = await fetchPosApi(url, 'POST', body);
                    const posResp = rawResponse;
                    const ventas = extractVentas(posResp);
                    const tipos = ventas.map((v) => v.tipo_documento).filter(Boolean);
                    const uniqueTipos = [...new Set(tipos)];
                    const docs = ventas.slice(0, 5).map((v) => ({
                        documento: v.documento, tipo_documento: v.tipo_documento, total: v.total, fecha: v.fecha
                    }));
                    res.json({
                        success: true,
                        endpoint: params.endpoint_path,
                        tipo: posResp.tipo,
                        mensajes: posResp.mensajes,
                        ventasCount: ventas.length,
                        uniqueTipos,
                        sampleDocs: docs,
                    });
                }
                catch (err) {
                    res.json({
                        success: false,
                        endpoint: params.endpoint_path,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
                return;
            }
            case 'catalogo': {
                if (!params?.local_id) {
                    res.status(400).json({ error: 'catalogo requires local_id' });
                    return;
                }
                const url = buildUrl(`/readonly/rest/delivery/obtenerCartaPorLocal/${POS_DOMAIN_ID}/${params.local_id}`, token);
                data = await fetchPosApi(url);
                break;
            }
            default:
                res.status(400).json({ error: `Unknown action: ${action}` });
                return;
        }
        res.json({ success: true, data });
    }
    catch (error) {
        console.error('POS Proxy error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});
//# sourceMappingURL=pos-proxy.js.map