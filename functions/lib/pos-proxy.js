import { onRequest } from 'firebase-functions/v2/https';
import { buildUrl, fetchPosApi, extractVentas, fetchAllPagesForLocal, delay, } from './pos-client.js';
import { TENANT_SECRETS, getTenantDomainId, getTenantToken, resolveCompanyTenant, } from './pos-tenants.js';
// Delay escalonado entre arranques de locales cuando hay > 1. El POS
// rate-limitea por token, pero permite algo de pipelining — mientras un
// local procesa su request en el servidor POS, el siguiente puede empezar
// a transitar. Un stagger de 1.5s evita colisiones iniciales sin matar el
// paralelismo. En el peor caso (POS rechaza concurrencia completa) el
// retry loop de fetchAllPagesForLocal se activa y aún así el wall-clock
// es mejor que el serial puro porque las páginas subsecuentes se
// pipelinean. Escalamos N locales × ~3s → ~N×1.5s + max(3s).
const LOCAL_STAGGER_MS = 1500;
async function fetchVentasBatch(token, domainId, localIds, f1, f2) {
    // Con 1 solo local no hay beneficio del stagger — llamada directa.
    if (localIds.length === 1) {
        const result = await fetchAllPagesForLocal(token, domainId, localIds[0], f1, f2);
        return {
            ventas: result.ventas,
            rateLimited: result.rateLimited,
            endpoint: 'obtenerVentasPorIntegracion',
        };
    }
    // Stagger + allSettled: un local que falle (rate-limit tras 3 retries o
    // network error) no aborta los demás. El serial previo devolvía las
    // ventas acumuladas hasta el fallo; con paralelo staggered recuperamos
    // las ventas de TODOS los locales que tuvieron éxito.
    const tasks = localIds.map((lid, i) => delay(i * LOCAL_STAGGER_MS).then(() => fetchAllPagesForLocal(token, domainId, lid, f1, f2)));
    const settled = await Promise.allSettled(tasks);
    const allVentas = [];
    let anyRateLimited = false;
    for (const r of settled) {
        if (r.status === 'fulfilled') {
            allVentas.push(...r.value.ventas);
            if (r.value.rateLimited)
                anyRateLimited = true;
        }
        else {
            console.warn('[pos-proxy] local fetch failed', r.reason);
            anyRateLimited = true;
        }
    }
    return {
        ventas: allVentas,
        rateLimited: anyRateLimited,
        endpoint: 'obtenerVentasPorIntegracion',
    };
}
export const posProxy = onRequest({
    cors: true,
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: TENANT_SECRETS,
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { action, params, companyId, tenantId: tenantIdOverride } = req.body;
        if (!action) {
            res.status(400).json({ error: 'action is required' });
            return;
        }
        // Resolver tenant: tenantId explícito gana; si no, derivar de companyId.
        let tenantId;
        if (tenantIdOverride) {
            tenantId = tenantIdOverride;
        }
        else if (companyId) {
            try {
                tenantId = await resolveCompanyTenant(companyId);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                res.status(400).json({ error: `No se pudo resolver tenant: ${msg}` });
                return;
            }
        }
        else {
            res.status(400).json({ error: 'companyId (o tenantId) es requerido' });
            return;
        }
        const token = getTenantToken(tenantId);
        const domainId = getTenantDomainId(tenantId);
        let data;
        switch (action) {
            case 'dominio': {
                const url = buildUrl(`/readonly/rest/delivery/obtenerInformacionDominio/${domainId}`, token);
                data = await fetchPosApi(url);
                break;
            }
            case 'ventas': {
                if (!params?.local_id || !params?.f1 || !params?.f2) {
                    res.status(400).json({ error: 'ventas requires local_id, f1, f2' });
                    return;
                }
                const url = buildUrl(`/readonly/rest/venta/obtenerVentasPorIntegracion/${domainId}`, token);
                data = await fetchPosApi(url, 'POST', {
                    pagina: params.pagina ?? 1,
                    local_id: params.local_id,
                    f1: params.f1,
                    f2: params.f2,
                    incluirNotasVenta: 1,
                });
                break;
            }
            case 'ventas-batch': {
                if (!params?.local_ids?.length || !params?.f1 || !params?.f2) {
                    res.status(400).json({ error: 'ventas-batch requires local_ids (array), f1, f2' });
                    return;
                }
                const batchResult = await fetchVentasBatch(token, domainId, params.local_ids, params.f1, params.f2);
                res.json({ success: true, data: batchResult });
                return;
            }
            case 'probe': {
                if (!params?.endpoint_path || !params?.local_id || !params?.f1 || !params?.f2) {
                    res.status(400).json({ error: 'probe requires endpoint_path, local_id, f1, f2' });
                    return;
                }
                try {
                    const url = buildUrl(params.endpoint_path, token);
                    const body = { local_id: params.local_id, f1: params.f1, f2: params.f2, pagina: params.pagina ?? 1, ...params };
                    delete body.endpoint_path;
                    delete body.local_ids;
                    const rawResponse = await fetchPosApi(url, 'POST', body);
                    const posResp = rawResponse;
                    const ventas = extractVentas(posResp);
                    const tipos = ventas
                        .map((v) => v.tipo_documento)
                        .filter(Boolean);
                    const uniqueTipos = [...new Set(tipos)];
                    const docs = ventas.slice(0, 5).map((v) => {
                        const rec = v;
                        return {
                            documento: rec.documento,
                            tipo_documento: rec.tipo_documento,
                            total: rec.total,
                            fecha: rec.fecha,
                        };
                    });
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
                const url = buildUrl(`/readonly/rest/delivery/obtenerCartaPorLocal/${domainId}/${params.local_id}`, token);
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