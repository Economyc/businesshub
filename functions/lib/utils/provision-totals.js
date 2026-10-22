// Provisiones de la venta POS: propinas, impoconsumo y autorretención.
//
// Port manual de `calcTotals`/`sumPropinas` de
// src/modules/pos-sync/utils/sales-calculations.ts (tarjetas de Punto de Venta →
// Ventas). El repo no comparte código entre src/ y functions/, así que si cambia
// el cálculo allá hay que cambiarlo aquí: el test
// src/modules/pos-sync/utils/provision-totals.test.ts compara ambos.
//
// Módulo puro (sin imports) a propósito, para que ese test lo pueda importar.
// Autorretención de renta: 3.5% sobre la venta facturada (solo tipo F) sin el
// impoconsumo. El `total` del POS trae el impoconsumo incluido.
export const AUTORRETENCION_RATE = 0.035;
function num(val) {
    return Number(val) || 0;
}
export function isVoided(v) {
    return String(v.estado_txt ?? '').toLowerCase() === 'comprobante anulado';
}
// Prioriza `lista_propinas`; si está vacío, cae a los pagos tipo propina.
export function sumPropinas(v) {
    let s = 0;
    for (const p of v.lista_propinas ?? [])
        s += num(p.montoConIgv);
    if (s > 0)
        return s;
    for (const p of v.pagosList ?? []) {
        const tipo = String(p.pagoventa_tipo ?? p.tipoPago ?? '').trim().toLowerCase();
        if (tipo.includes('propina') || tipo.includes('tip'))
            s += num(p.pagoventa_monto ?? p.monto);
    }
    return s;
}
/** Totales de provisión de una lista de ventas. Ignora las anuladas. */
export function calcProvisions(ventas) {
    let count = 0;
    let propinas = 0;
    let impoconsumo = 0;
    let base = 0;
    for (const v of ventas) {
        if (isVoided(v))
            continue;
        count++;
        propinas += sumPropinas(v);
        impoconsumo += num(v.impuestos);
        if (String(v.tipo_documento ?? '').toUpperCase() === 'F')
            base += num(v.total) - num(v.impuestos);
    }
    return { count, propinas, impoconsumo, retefuente: base * AUTORRETENCION_RATE };
}
export function addProvisions(a, b) {
    return {
        count: a.count + b.count,
        propinas: a.propinas + b.propinas,
        impoconsumo: a.impoconsumo + b.impoconsumo,
        retefuente: a.retefuente + b.retefuente,
    };
}
export const EMPTY_PROVISIONS = { count: 0, propinas: 0, impoconsumo: 0, retefuente: 0 };
//# sourceMappingURL=provision-totals.js.map