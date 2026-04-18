// Cliente HTTP reusable contra el POS de restaurant.pe.
// Lo usan tanto `pos-proxy` (expone HTTP al browser) como `pos-reconcile`
// (cron nocturno que hidrata cache server-side). Toda comunicación con el POS
// debe pasar por aquí para mantener un único lugar con el rate-limit, retries
// y manejo de "tipo !== 1" — el POS entrega errores y rate-limits dentro del
// body con status 200, así que no basta con revisar `res.ok`.
export const POS_BASE_URL = 'http://api.restaurant.pe/restaurant';
export const POS_DOMAIN_ID = '8267';
export const BATCH_DELAY_MS = 5000;
export const MAX_RETRIES = 3;
export function buildUrl(path, token) {
    return `${POS_BASE_URL}${path}?token=${token.trim()}`;
}
export function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function fetchPosApi(url, method = 'GET', body) {
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
export function isRateLimited(response) {
    const msg = (response.mensajes || []).join(' ').toLowerCase();
    return msg.includes('solicitud en ejecuci') || msg.includes('esper');
}
export function extractVentas(response) {
    const d = response.data;
    if (Array.isArray(d))
        return d;
    if (d && typeof d === 'object')
        return Object.values(d);
    return [];
}
export async function fetchDominio(token) {
    const url = buildUrl(`/readonly/rest/delivery/obtenerInformacionDominio/${POS_DOMAIN_ID}`, token);
    const raw = (await fetchPosApi(url));
    const tipo = Number(raw.tipo);
    if (tipo !== 1) {
        const msg = (raw.mensajes || []).join(', ') || `POS error tipo ${tipo}`;
        throw new Error(msg);
    }
    const data = raw.data;
    const locales = Array.isArray(data?.locales) ? data.locales : [];
    return { ...data, locales };
}
// Pagina `obtenerVentasPorIntegracion` para un local en el rango [f1, f2].
// El POS cooldownea ~5s entre requests al mismo token; si nos dice "solicitud
// en ejecución" reintentamos hasta MAX_RETRIES esperando BATCH_DELAY_MS.
export async function fetchAllPagesForLocal(token, localId, f1, f2) {
    const endpointPath = `/readonly/rest/venta/obtenerVentasPorIntegracion/${POS_DOMAIN_ID}`;
    const ventas = [];
    let pagina = 1;
    let requestCount = 0;
    while (true) {
        let response = null;
        let succeeded = false;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                await delay(BATCH_DELAY_MS);
            }
            const url = buildUrl(endpointPath, token);
            response = (await fetchPosApi(url, 'POST', {
                local_id: localId,
                f1,
                f2,
                pagina,
                incluirNotasVenta: 1,
            }));
            requestCount++;
            if (isRateLimited(response)) {
                continue;
            }
            succeeded = true;
            break;
        }
        if (!succeeded) {
            return { ventas, rateLimited: true, requestCount };
        }
        const tipo = Number(response.tipo);
        if (tipo !== 1) {
            if (pagina === 1) {
                const msg = (response.mensajes || []).join(', ') || `POS error tipo ${tipo}`;
                throw new Error(msg);
            }
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
export async function fetchCatalogo(token, localId) {
    const url = buildUrl(`/readonly/rest/delivery/obtenerCartaPorLocal/${POS_DOMAIN_ID}/${localId}`, token);
    const raw = (await fetchPosApi(url));
    const tipo = Number(raw.tipo);
    if (tipo !== 1) {
        const msg = (raw.mensajes || []).join(', ') || `POS error tipo ${tipo}`;
        throw new Error(msg);
    }
    const d = raw.data;
    if (Array.isArray(d))
        return d;
    if (d && typeof d === 'object')
        return Object.values(d);
    return [];
}
//# sourceMappingURL=pos-client.js.map