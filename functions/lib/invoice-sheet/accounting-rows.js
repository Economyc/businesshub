// Port server-side de la hoja de seguimiento de facturas/pagos.
//
// Replica fiel de `src/modules/finance/utils/accounting-export.ts` y de
// `parseCategory` de `src/core/utils/categories.ts`. No se puede importar `src/`
// desde `functions/` (paquetes TS separados, alias `@/` propio del front), por
// eso se copia. Si cambian las columnas o la lógica en el cliente, actualizar
// ambos lados. Las fechas aquí son `Timestamp` de firebase-admin (tiene
// `.toDate()` igual que el SDK del cliente).
export const ACCOUNTING_FIELDS = [
    { key: 'numeracion', header: 'Numeración', type: 'string' },
    { key: 'fecha', header: 'Fecha', type: 'string' },
    { key: 'nit', header: 'NIT', type: 'string' },
    { key: 'proveedor', header: 'Proveedor', type: 'string' },
    { key: 'concepto', header: 'Concepto', type: 'string' },
    { key: 'categoria', header: 'Categoría', type: 'string' },
    { key: 'prioridad', header: 'Prioridad', type: 'string' },
    { key: 'tipo', header: 'Tipo', type: 'string' },
    { key: 'numero', header: 'Número', type: 'string' },
    { key: 'valor', header: 'Valor', type: 'number' },
    { key: 'estado', header: 'Estado', type: 'string' },
    { key: 'metodoPago', header: 'Metodo Pago', type: 'string' },
    { key: 'notas', header: 'Notas', type: 'string' },
];
// Fecha DD/MM/AAAA. Devuelve '—' cuando no hay fecha (data legacy).
function formatDate(ts) {
    const d = ts?.toDate?.();
    if (!d)
        return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}
function tipoLabel(t) {
    return t.documentKind === 'invoice' ? 'Factura' : 'Compra';
}
function estadoLabel(status) {
    if (status === 'paid')
        return 'Pagado';
    if (status === 'overdue')
        return 'Vencida';
    return 'Pendiente';
}
// Misma sanitización que doc-naming.sanitizeForFileName para que la Numeración
// coincida con el nombre real del PDF en Drive.
function sanitize(s) {
    return s.replace(/[\\/:*?"<>|]/g, '').trim();
}
function buildNumeracion(index, t) {
    const proveedor = sanitize(t.payeeRef?.name ?? 'Proveedor');
    const numero = sanitize(t.docNumber ?? '');
    return `${index}. ${proveedor} - ${tipoLabel(t)}${numero ? ` ${numero}` : ''}`;
}
// Replica de parseCategory: "Categoría > Subcategoría" → "Categoría".
function parseCategoryName(value) {
    return value.split(' > ')[0] ?? '';
}
export function buildAccountingRows(txs, suppliersById, startIndex = 1) {
    return txs.map((t, i) => {
        const nit = t.payeeRef?.type === 'supplier' && t.payeeRef.id
            ? suppliersById.get(t.payeeRef.id) ?? ''
            : '';
        return {
            numeracion: buildNumeracion(startIndex + i, t),
            fecha: formatDate(t.date),
            nit,
            proveedor: t.payeeRef?.name ?? '',
            concepto: t.concept ?? '',
            categoria: parseCategoryName(t.category ?? ''),
            prioridad: t.priority === 'immediate' ? 'Inmediato' : 'Espera',
            tipo: tipoLabel(t),
            numero: t.docNumber ?? '',
            valor: t.amount ?? 0,
            estado: estadoLabel(t.status),
            metodoPago: '',
            notas: t.notes ?? '',
        };
    });
}
//# sourceMappingURL=accounting-rows.js.map