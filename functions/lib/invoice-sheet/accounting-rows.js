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
    if (t.documentKind === 'receivable')
        return 'Cuenta por cobrar';
    // Turno extra pagado a una persona (Ecore): no es compra a un proveedor.
    if (t.documentKind === 'extra')
        return 'Extra';
    return t.documentKind === 'invoice' ? 'Factura' : 'Compra';
}
function estadoLabel(status) {
    if (status === 'paid')
        return 'Pagado';
    if (status === 'partial')
        return 'Parcial';
    if (status === 'overdue')
        return 'Vencida';
    return 'Pendiente';
}
// Abonado / saldo / % a partir de los denormalizados de Ecore, con fallback para
// data sin abonos (paid → todo abonado; resto → nada abonado).
function paidParts(t) {
    const amount = t.amount ?? 0;
    const paid = t.paidAmount ?? (t.status === 'paid' ? amount : 0);
    const saldo = t.remainingAmount ?? Math.max(amount - paid, 0);
    const pct = amount > 0 ? `${Math.round((paid / amount) * 100)}%` : '0%';
    return { paid, saldo, pct };
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
// Concepto con la marca del reparto cuando la factura es un gasto compartido
// entre locales. Sin ella, la contadora ve el mismo número de factura en dos
// hojas con dos valores distintos y ninguno cuadra contra el documento físico.
// Va en Concepto y no en Numeración: esa última debe seguir coincidiendo
// exactamente con el nombre del PDF en Drive.
function conceptoLabel(t) {
    const concepto = t.concept ?? '';
    const id = t.splitGroupId;
    const isShared = !!id && (id.startsWith('split-') || id.startsWith('rsplit-'));
    if (!isShared || t.splitTotalAmount == null)
        return concepto;
    const share = t.splitSharePct != null ? `${t.splitSharePct}% ` : '';
    const total = t.splitTotalAmount.toLocaleString('es-CO');
    return `${concepto} [compartida — ${share}de $${total}]`;
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
            concepto: conceptoLabel(t),
            categoria: parseCategoryName(t.category ?? ''),
            prioridad: t.priority === 'immediate' ? 'Inmediato' : 'Espera',
            tipo: tipoLabel(t),
            numero: t.docNumber ?? '',
            valor: t.amount ?? 0,
            estado: estadoLabel(t.status),
            metodoPago: t.paymentMethod ?? '',
            notas: t.notes ?? '',
        };
    });
}
// ───────────────────────────────────────────────────────────────────────────
// F6 — Pestañas del modelo Ecore (Por Pagar / Por Cobrar / Entre Locales /
// Abonos / Traslados). Filas planas; el layout lo da build-workbook.
// ───────────────────────────────────────────────────────────────────────────
// Por Pagar / Por Cobrar comparten estructura; solo cambia el header del tercero.
function payableFields(terceroHeader) {
    return [
        { key: 'numeracion', header: 'Numeración', type: 'string' },
        { key: 'fecha', header: 'Fecha', type: 'string' },
        { key: 'vencimiento', header: 'Vencimiento', type: 'string' },
        { key: 'nit', header: 'NIT', type: 'string' },
        { key: 'tercero', header: terceroHeader, type: 'string' },
        { key: 'concepto', header: 'Concepto', type: 'string' },
        { key: 'categoria', header: 'Categoría', type: 'string' },
        { key: 'numero', header: 'Número', type: 'string' },
        { key: 'valor', header: 'Valor', type: 'number' },
        { key: 'abonado', header: 'Abonado', type: 'number' },
        { key: 'saldo', header: 'Saldo', type: 'number' },
        { key: 'porcentaje', header: '% Pagado', type: 'string' },
        { key: 'estado', header: 'Estado', type: 'string' },
        { key: 'notas', header: 'Notas', type: 'string' },
    ];
}
export const PAYABLE_FIELDS = payableFields('Proveedor');
export const RECEIVABLE_FIELDS = payableFields('Cliente');
export function buildPayableRows(txs, suppliersById, startIndex = 1) {
    return txs.map((t, i) => {
        const nit = t.payeeRef?.type === 'supplier' && t.payeeRef.id
            ? suppliersById.get(t.payeeRef.id) ?? ''
            : '';
        const { paid, saldo, pct } = paidParts(t);
        return {
            numeracion: buildNumeracion(startIndex + i, t),
            fecha: formatDate(t.date),
            vencimiento: t.dueDate ? formatDate(t.dueDate) : '—',
            nit,
            tercero: t.payeeRef?.name ?? '',
            concepto: conceptoLabel(t),
            categoria: parseCategoryName(t.category ?? ''),
            numero: t.docNumber ?? '',
            valor: t.amount ?? 0,
            abonado: paid,
            saldo,
            porcentaje: pct,
            estado: estadoLabel(t.status),
            notas: t.notes ?? '',
        };
    });
}
export const INTERLOCAL_FIELDS = [
    { key: 'fecha', header: 'Fecha', type: 'string' },
    { key: 'rol', header: 'Rol', type: 'string' },
    { key: 'contraparte', header: 'Contraparte', type: 'string' },
    { key: 'concepto', header: 'Concepto', type: 'string' },
    { key: 'valor', header: 'Valor', type: 'number' },
    { key: 'abonado', header: 'Abonado', type: 'number' },
    { key: 'saldo', header: 'Saldo', type: 'number' },
    { key: 'porcentaje', header: '% Pagado', type: 'string' },
    { key: 'estado', header: 'Estado', type: 'string' },
];
export function buildInterLocalRows(txs) {
    return txs.map((t) => {
        const { paid, saldo, pct } = paidParts(t);
        return {
            fecha: formatDate(t.date),
            rol: t.type === 'income' ? 'Por cobrar' : 'Por pagar',
            contraparte: t.payeeRef?.name ?? '',
            concepto: t.concept ?? '',
            valor: t.amount ?? 0,
            abonado: paid,
            saldo,
            porcentaje: pct,
            estado: estadoLabel(t.status),
        };
    });
}
export const TRANSFER_FIELDS = [
    { key: 'fecha', header: 'Fecha', type: 'string' },
    { key: 'origen', header: 'Origen', type: 'string' },
    { key: 'destino', header: 'Destino', type: 'string' },
    { key: 'valor', header: 'Monto', type: 'number' },
    { key: 'referencia', header: 'Referencia', type: 'string' },
    { key: 'notas', header: 'Notas', type: 'string' },
];
export function buildTransferRows(transfers) {
    return transfers
        .slice()
        .sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0))
        .map((tr) => ({
        fecha: formatDate(tr.date),
        origen: tr.fromMethod ?? '',
        destino: tr.toMethod ?? '',
        valor: tr.amount ?? 0,
        referencia: tr.reference ?? '',
        notas: tr.notes ?? '',
    }));
}
export const PAYMENT_FIELDS = [
    { key: 'factura', header: 'Factura', type: 'string' },
    { key: 'tercero', header: 'Tercero', type: 'string' },
    { key: 'fecha', header: 'Fecha abono', type: 'string' },
    { key: 'valor', header: 'Monto', type: 'number' },
    { key: 'acumulado', header: '% Acumulado', type: 'string' },
    { key: 'saldo', header: 'Saldo', type: 'number' },
    { key: 'metodo', header: 'Método', type: 'string' },
];
// Aplana los abonos de las tx gestionadas. Por factura: ordena por fecha y lleva
// suma corriente para % acumulado y saldo restante tras cada abono.
export function buildPaymentRows(groups) {
    const rows = [];
    for (const { tx, payments } of groups) {
        const amount = tx.amount ?? 0;
        const facturaLabel = `${tx.concept ?? ''}${tx.docNumber ? ` (${tx.docNumber})` : ''}`.trim();
        const ordered = payments
            .slice()
            .sort((a, b) => (a.date?.toMillis?.() ?? 0) - (b.date?.toMillis?.() ?? 0));
        let running = 0;
        for (const p of ordered) {
            running += p.amount ?? 0;
            rows.push({
                factura: facturaLabel || '—',
                tercero: tx.payeeRef?.name ?? '',
                fecha: formatDate(p.date),
                valor: p.amount ?? 0,
                acumulado: amount > 0 ? `${Math.round((running / amount) * 100)}%` : '—',
                saldo: Math.max(amount - running, 0),
                metodo: p.method ?? '',
            });
        }
    }
    return rows;
}
//# sourceMappingURL=accounting-rows.js.map