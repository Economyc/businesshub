// Handlers del bot de Telegram. El bot es privado: todo update exige un
// link chatId↔uid en telegramLinks (creado vía /start TOKEN).
//
// Flujo de escritura: el LLM invoca una tool sin execute → guardamos la
// mutación pendiente + card con botones → callback ✅ ejecuta server-side
// (mutations.ts), inyecta el tool-result al historial y una segunda llamada
// LLM redacta el cierre. Solo una mutación pendiente por chat: un mensaje
// nuevo del usuario descarta la anterior (mantiene el historial sin
// tool-calls huérfanos, que Gemini rechaza).
import { Bot, InlineKeyboard } from 'grammy';
import { resolveLink, consumeLinkToken, loadUserCompanies, } from './auth.js';
import { loadHistory, saveHistory, clearHistory, loadChatState, updateChatState, } from './history.js';
import { runAgentTurn, AllProvidersBusyError } from './agent-runner.js';
import { createTelegramTools, FILE_TOOL_NAMES } from './tools.js';
import { savePendingMutation, setPendingMessageId, claimPendingMutation, finalizePendingMutation, buildConfirmationText, } from './confirmations.js';
import { executeServerMutation } from './mutations.js';
import { downloadTelegramFile, TelegramFileError } from './files.js';
import { resolveCompany } from './resolve-payee.js';
import { toTelegramText, chunkText } from './format.js';
import { db, fetchCollection } from '../firestore.js';
import { createCallbackRouter } from './callbacks.js';
import { buildMainMenu, MAIN_MENU_TEXT } from './menus.js';
import { buildCompanySelector, registerCompanySelect } from './company-select.js';
import { openPayFlow, registerPayFlow } from './pay-flow.js';
import { startQuickEntry, registerQuickEntry, loadQuickEntryState, quickEntryInstructions } from './quick-entry.js';
import { registerDatePicker } from './date-picker.js';
import { sendPendingPaymentsPdf, registerPendingPdf } from './pending-pdf.js';
import { patchCallbackState } from './callback-state.js';
const NOT_LINKED_MESSAGE = 'Este bot es privado. Genera tu enlace de vinculación desde BusinessHub → Ajustes → Conectar Telegram.';
const ALLOWED_DOC_MIMES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
]);
async function loadUserMemory(uid) {
    try {
        const snap = await db
            .collection('users')
            .doc(uid)
            .collection('agentMemory')
            .doc('preferences')
            .get();
        return snap.exists ? snap.data() : null;
    }
    catch {
        return null;
    }
}
/**
 * Catálogo global de categorías (settings/categories, mismo doc que usa la
 * web) inyectado al system prompt para que el agente no invente categorías.
 */
async function loadCategoriesBlock() {
    try {
        const snap = await db.collection('settings').doc('categories').get();
        const items = (snap.data()?.categories ?? []);
        if (items.length === 0)
            return '';
        const lines = items
            .filter((c) => c.name)
            .map((c) => c.subcategories && c.subcategories.length > 0
            ? `- ${c.name} (subcategorías: ${c.subcategories.join(', ')})`
            : `- ${c.name}`);
        return [
            '## Categorías disponibles',
            'Para el campo category usa EXACTAMENTE una de estas, en formato "Categoría" o "Categoría > Subcategoría":',
            ...lines,
            'Si ninguna calza bien, usa "Otros" y sugiere en tu texto crear una nueva desde la web.',
        ].join('\n');
    }
    catch {
        return '';
    }
}
/**
 * Catálogo de proveedores registrados inyectado al system prompt para que el
 * agente use el nombre canónico y la categoría del maestro (no lo que leyó de
 * la imagen). `/suppliers` es colección raíz compartida entre companies, así
 * que el bloque es el mismo para todas; lo cacheamos en el proceso warm
 * (concurrency=1, maxInstances=1) con TTL corto para no releerlo en cada update.
 */
const SUPPLIERS_CACHE_TTL_MS = 5 * 60 * 1000;
const SUPPLIERS_MAX = 200;
let suppliersBlockCache = null;
async function loadSuppliersBlock(companyId) {
    const now = Date.now();
    if (suppliersBlockCache && now - suppliersBlockCache.at < SUPPLIERS_CACHE_TTL_MS) {
        return suppliersBlockCache.value;
    }
    let value = '';
    try {
        const docs = await fetchCollection(companyId, 'suppliers');
        const active = docs
            .filter((s) => s.status === 'active' && String(s.name ?? '').trim().length > 0)
            .map((s) => ({ name: String(s.name).trim(), category: s.category ? String(s.category).trim() : '' }))
            .sort((a, b) => a.name.localeCompare(b.name));
        // Si el catálogo es enorme, degradar a no inyectar (la Capa 2 server cubre el
        // match) en vez de mandar un prompt gigante.
        if (active.length > 0 && active.length <= SUPPLIERS_MAX) {
            const lines = active.map((s) => s.category ? `- ${s.name} → categoría: ${s.category}` : `- ${s.name}`);
            value = [
                '## Proveedores registrados',
                'Al registrar una factura/compra (createPayableDocument), compara el proveedor del documento con esta lista.',
                'Si encuentras el más parecido (aunque el nombre del documento difiera, ej. "Super Carner Walter" ≈ "Carnes Walter"):',
                '- usa el nombre EXACTO de la lista en supplierName,',
                '- usa la categoría registrada de esa línea en el campo category,',
                '- NO marques customSupplier.',
                'Solo si ninguno calza razonablemente, trátalo como proveedor ocasional (customSupplier=true) con el nombre del documento.',
                ...lines,
            ].join('\n');
        }
    }
    catch {
        value = '';
    }
    suppliersBlockCache = { value, at: now };
    return value;
}
/** sendChatAction expira a los ~5s; lo repetimos mientras corre el LLM. */
function startTyping(ctx) {
    const send = () => ctx.api.sendChatAction(ctx.chat.id, 'typing').catch(() => { });
    void send();
    const interval = setInterval(send, 4500);
    return () => clearInterval(interval);
}
async function sendAgentText(ctx, text) {
    const plain = toTelegramText(text);
    if (!plain)
        return;
    for (const chunk of chunkText(plain)) {
        await ctx.reply(chunk);
    }
}
function companyLabelFor(args, companies, activeCompanyId) {
    const name = args.targetCompanyName;
    if (typeof name === 'string' && name.trim()) {
        const r = resolveCompany(name, companies);
        if (r.ok)
            return r.company.location ? `${r.company.name} (${r.company.location})` : r.company.name;
        return name;
    }
    const active = companies.find((c) => c.id === activeCompanyId);
    if (!active)
        return 'el local activo';
    return active.location ? `${active.name} (${active.location})` : active.name;
}
/**
 * Si hay una mutación pendiente sin resolver, la descarta (el historial no
 * puede avanzar con un tool-call sin resultado). Devuelve el historial con el
 * tool-result de cancelación inyectado.
 */
async function discardStalePending(ctx, chatId, state, history) {
    const pendingId = state.pendingMutationId;
    if (!pendingId)
        return history;
    const claim = await claimPendingMutation(pendingId);
    await updateChatState(chatId, { pendingMutationId: null });
    if (!claim.ok)
        return history;
    await finalizePendingMutation(pendingId, 'cancelled');
    if (claim.mutation.telegramMessageId) {
        await ctx.api
            .editMessageReplyMarkup(chatId, claim.mutation.telegramMessageId, { reply_markup: undefined })
            .catch(() => { });
    }
    return [
        ...history,
        {
            role: 'tool',
            content: [
                {
                    type: 'tool-result',
                    toolCallId: claim.mutation.toolCallId,
                    toolName: claim.mutation.toolName,
                    result: {
                        success: false,
                        message: 'El usuario respondió en vez de confirmar; esta propuesta quedó descartada. ' +
                            'Si su nuevo mensaje corrige datos, vuelve a invocar la misma herramienta con todos los campos aplicando las correcciones.',
                    },
                },
            ],
        },
    ];
}
/**
 * Entrega el resultado de un turno del agente: texto directo, o card de
 * confirmación si quedó una tool de escritura pendiente.
 */
async function deliverAgentResult(ctx, turn, history, tc) {
    let newHistory = [...history, ...turn.responseMessages];
    if (turn.pendingToolCalls.length === 0) {
        await saveHistory(tc.chatId, newHistory);
        await sendAgentText(ctx, turn.text || 'Listo.');
        return;
    }
    // Una sola escritura por turno: la primera va a confirmación, las demás se
    // descartan con tool-result sintético (el prompt ya pide de a una).
    const [first, ...extras] = turn.pendingToolCalls;
    for (const extra of extras) {
        newHistory = [
            ...newHistory,
            {
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId: extra.toolCallId,
                        toolName: extra.toolName,
                        result: {
                            success: false,
                            message: 'Descartada automáticamente: solo una operación de escritura por mensaje.',
                        },
                    },
                ],
            },
        ];
    }
    if (turn.text)
        await sendAgentText(ctx, turn.text);
    const needsFile = FILE_TOOL_NAMES.has(first.toolName);
    const pendingId = await savePendingMutation({
        chatId: tc.chatId,
        uid: tc.uid,
        companyId: tc.activeCompanyId,
        toolName: first.toolName,
        toolCallId: first.toolCallId,
        args: first.args,
        telegramFileId: needsFile ? tc.attachmentFileId : null,
        telegramFileMime: needsFile ? tc.attachmentMime : null,
        telegramFileName: needsFile ? tc.attachmentName : null,
    });
    const cardText = buildConfirmationText(first.toolName, first.args, companyLabelFor(first.args, tc.companies, tc.activeCompanyId), needsFile ? Boolean(tc.attachmentFileId) : true);
    const keyboard = new InlineKeyboard()
        .text('✅ Confirmar', `cf:${pendingId}`)
        .text('❌ Cancelar', `cx:${pendingId}`);
    const cardWithHint = cardText +
        '\n\n✏️ ¿Algo está mal? Respóndeme con la corrección (ej. "el monto es 39.500" o "la categoría es Suministros > Insumos") y te muestro la tarjeta corregida.';
    const sent = await ctx.reply(cardWithHint, { reply_markup: keyboard });
    await setPendingMessageId(pendingId, sent.message_id);
    await updateChatState(tc.chatId, { pendingMutationId: pendingId });
    await saveHistory(tc.chatId, newHistory);
}
export function createTelegramBot(cfg) {
    const bot = new Bot(cfg.token);
    // Router de callbacks por namespace (m:/co:/pf:/qe:/dp:/pp:). Convive con el
    // flujo legacy cf:/cx: — ver el handler callback_query:data más abajo.
    const router = createCallbackRouter();
    registerCompanySelect(router);
    registerPayFlow(router);
    registerQuickEntry(router);
    registerDatePicker(router);
    registerPendingPdf(router);
    // Menú principal (namespace m:). Reusa los entry points de cada flujo.
    router.register('m', async (ctx, args, deps) => {
        const action = args[0];
        if (action === 'home') {
            await ctx.editMessageText(MAIN_MENU_TEXT, { reply_markup: buildMainMenu() }).catch(() => { });
        }
        else if (action === 'pay') {
            await openPayFlow(ctx, deps);
        }
        else if (action === 'add') {
            await startQuickEntry(ctx, deps.chatId);
        }
        else if (action === 'co') {
            const selector = await buildCompanySelector(deps.uid, deps.chatId);
            if (selector)
                await ctx.editMessageText(selector.text, { reply_markup: selector.keyboard }).catch(() => { });
            else
                await ctx.editMessageText('Tu usuario no tiene empresas activas.').catch(() => { });
        }
        else if (action === 'pdf') {
            await sendPendingPaymentsPdf(ctx, deps);
        }
    });
    // Solo chats privados.
    bot.use(async (ctx, next) => {
        if (ctx.chat && ctx.chat.type !== 'private')
            return;
        await next();
    });
    // ── /start [token] ───────────────────────────────────────────────────
    bot.command('start', async (ctx) => {
        const chatId = ctx.chat.id;
        const token = (ctx.match ?? '').trim();
        const existing = await resolveLink(chatId);
        if (existing && !token) {
            await ctx.reply('Ya estás vinculado ✅. Escríbeme lo que necesites — por ejemplo: "¿cuánto tengo vencido?" o mándame la foto de una factura.');
            return;
        }
        if (!token) {
            await ctx.reply(NOT_LINKED_MESSAGE);
            return;
        }
        const result = await consumeLinkToken(token, chatId, ctx.from?.username);
        if (!result.ok) {
            const reason = result.reason === 'expired'
                ? 'El enlace expiró (dura 15 minutos).'
                : result.reason === 'used'
                    ? 'Ese enlace ya fue usado.'
                    : 'Enlace inválido.';
            await ctx.reply(`${reason} Genera uno nuevo desde BusinessHub → Ajustes.`);
            return;
        }
        const companies = await loadUserCompanies(result.uid);
        if (companies.length > 0) {
            await updateChatState(chatId, {
                uid: result.uid,
                activeCompanyId: companies[0].id,
                activeCompanyName: companies[0].name,
            });
        }
        const list = companies
            .map((c) => `- ${c.name}${c.location ? ` (${c.location})` : ''}`)
            .join('\n');
        await ctx.reply(`Cuenta vinculada ✅\n\nTus empresas:\n${list || '- (ninguna activa)'}\n\nLocal activo: ${companies[0]?.name ?? 'ninguno'}. Cámbialo con /empresa <nombre>.\n\nPrueba: "crea una cuenta por cobrar de 200 mil a Pepito en ${companies[0]?.name ?? 'tu local'}" o mándame la foto de una factura.`);
    });
    // ── Resto: exige vinculación ─────────────────────────────────────────
    bot.use(async (ctx, next) => {
        const chatId = ctx.chat?.id;
        if (!chatId)
            return;
        const link = await resolveLink(chatId);
        if (!link) {
            if (ctx.callbackQuery)
                await ctx.answerCallbackQuery().catch(() => { });
            else
                await ctx.reply(NOT_LINKED_MESSAGE);
            return;
        }
        ctx.state = { uid: link.uid };
        await next();
    });
    bot.command('reset', async (ctx) => {
        await clearHistory(ctx.chat.id);
        await updateChatState(ctx.chat.id, { pendingMutationId: null, latestAttachment: null });
        await ctx.reply('Memoria de la conversación borrada 🧹');
    });
    // ── Menú principal y atajos por botones ──────────────────────────────
    bot.command('menu', async (ctx) => {
        await ctx.reply(MAIN_MENU_TEXT, { reply_markup: buildMainMenu() });
    });
    bot.command('pagar', async (ctx) => {
        await openPayFlow(ctx, { cfg, chatId: ctx.chat.id, uid: ctx.state.uid });
    });
    bot.command('registrar', async (ctx) => {
        await startQuickEntry(ctx, ctx.chat.id);
    });
    bot.command('pendientes', async (ctx) => {
        await sendPendingPaymentsPdf(ctx, { cfg, chatId: ctx.chat.id, uid: ctx.state.uid });
    });
    bot.command('empresa', async (ctx) => {
        const uid = ctx.state.uid;
        const arg = (ctx.match ?? '').trim();
        const companies = await loadUserCompanies(uid);
        if (!arg) {
            const selector = await buildCompanySelector(uid, ctx.chat.id);
            if (selector)
                await ctx.reply(selector.text, { reply_markup: selector.keyboard });
            else
                await ctx.reply('Tu usuario no tiene empresas activas.');
            return;
        }
        const resolved = resolveCompany(arg, companies);
        if (!resolved.ok) {
            await ctx.reply(resolved.reason === 'ambiguous'
                ? `"${arg}" es ambiguo: ${resolved.matches.map((c) => c.name).join(', ')}.`
                : `No encontré "${arg}".`);
            return;
        }
        await updateChatState(ctx.chat.id, {
            activeCompanyId: resolved.company.id,
            activeCompanyName: resolved.company.name,
        });
        await ctx.reply(`Local activo: ${resolved.company.name}${resolved.company.location ? ` (${resolved.company.location})` : ''} ✅`);
    });
    // ── Callbacks de confirmación ────────────────────────────────────────
    bot.on('callback_query:data', async (ctx) => {
        // answerCallbackQuery YA, antes de ejecutar nada (Telegram exige <15s).
        await ctx.answerCallbackQuery().catch(() => { });
        // Router de menús/botones (m:/co:/pf:/qe:/dp:/pp:). Si lo maneja, terminamos;
        // si no, cae al flujo legacy cf:/cx: de confirmación de mutaciones.
        const chatId = ctx.chat.id;
        const uid = ctx.state.uid;
        const deps = { cfg, chatId, uid };
        if (await router.dispatch(ctx, deps))
            return;
        const data = ctx.callbackQuery.data;
        const match = /^(cf|cx):(.+)$/.exec(data);
        if (!match)
            return;
        const [, action, pendingId] = match;
        const claim = await claimPendingMutation(pendingId);
        if (!claim.ok) {
            await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => { });
            await ctx.reply('⌛ Esa operación ya fue procesada o expiró.');
            return;
        }
        const mutation = claim.mutation;
        await updateChatState(chatId, { pendingMutationId: null });
        // Mutaciones nacidas de botón (pay-flow/quick-entry): el toolCallId es
        // sintético y no hay tool-call en el historial → ejecutar sin LLM ni tocar
        // el historial conversacional. (Las del agente IA siguen el flujo de abajo.)
        if (mutation.origin === 'ui') {
            const baseText = ctx.callbackQuery.message?.text ?? '';
            if (action === 'cx') {
                await finalizePendingMutation(pendingId, 'cancelled');
                await ctx.editMessageText(`${baseText}\n\n❌ Cancelada`).catch(() => { });
                return;
            }
            const stopUi = startTyping(ctx);
            try {
                const companies = await loadUserCompanies(uid);
                const result = await executeServerMutation({
                    uid,
                    defaultCompanyId: mutation.companyId,
                    toolName: mutation.toolName,
                    args: mutation.args,
                    companies,
                    attachment: null,
                });
                await finalizePendingMutation(pendingId, 'done', result.id);
                await ctx
                    .editMessageText(`${baseText}\n\n${result.success ? '✅ Confirmada' : '⚠️ Falló'}`)
                    .catch(() => { });
                await ctx.reply(`${result.success ? '✅' : '⚠️'} ${result.message}`);
            }
            finally {
                stopUi();
            }
            return;
        }
        const history = await loadHistory(chatId);
        const appendToolResult = (result) => [
            ...history,
            {
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId: mutation.toolCallId,
                        toolName: mutation.toolName,
                        result,
                    },
                ],
            },
        ];
        if (action === 'cx') {
            await finalizePendingMutation(pendingId, 'cancelled');
            const newHistory = [
                ...appendToolResult({ success: false, message: 'El usuario canceló la operación.' }),
                { role: 'assistant', content: [{ type: 'text', text: 'Operación cancelada.' }] },
            ];
            await saveHistory(chatId, newHistory);
            await ctx.editMessageText(`${ctx.callbackQuery.message?.text ?? ''}\n\n❌ Cancelada`).catch(() => { });
            return;
        }
        // ── Confirmar ──
        const stopTyping = startTyping(ctx);
        try {
            // Re-descarga el adjunto por file_id (nunca persistimos binarios).
            let attachment = null;
            if (FILE_TOOL_NAMES.has(mutation.toolName) && mutation.telegramFileId) {
                try {
                    attachment = await downloadTelegramFile(cfg.token, mutation.telegramFileId, {
                        mimeType: mutation.telegramFileMime ?? 'image/jpeg',
                        fileName: mutation.telegramFileName ?? undefined,
                    });
                }
                catch (err) {
                    if (err instanceof TelegramFileError) {
                        await finalizePendingMutation(pendingId, 'cancelled');
                        const newHistory = [
                            ...appendToolResult({ success: false, message: `No se pudo recuperar el archivo: ${err.message}` }),
                            { role: 'assistant', content: [{ type: 'text', text: err.message }] },
                        ];
                        await saveHistory(chatId, newHistory);
                        await ctx.editMessageText(`${ctx.callbackQuery.message?.text ?? ''}\n\n⚠️ Archivo no disponible`).catch(() => { });
                        await ctx.reply(`⚠️ ${err.message}`);
                        return;
                    }
                    throw err;
                }
            }
            const companies = await loadUserCompanies(uid);
            const result = await executeServerMutation({
                uid,
                defaultCompanyId: mutation.companyId,
                toolName: mutation.toolName,
                args: mutation.args,
                companies,
                attachment,
            });
            await finalizePendingMutation(pendingId, 'done', result.id);
            await ctx
                .editMessageText(`${ctx.callbackQuery.message?.text ?? ''}\n\n${result.success ? '✅ Confirmada' : '⚠️ Falló'}`)
                .catch(() => { });
            const historyWithResult = appendToolResult(result);
            // Cierre del turno: el LLM redacta la respuesta final. La mutación YA
            // ocurrió — si el LLM falla, mandamos el mensaje crudo, jamás reintentamos.
            try {
                const state = await loadChatState(chatId);
                const activeCompanyId = state.activeCompanyId ?? mutation.companyId;
                const [userMemory, categoriesBlock, suppliersBlock] = await Promise.all([
                    loadUserMemory(uid),
                    loadCategoriesBlock(),
                    loadSuppliersBlock(activeCompanyId),
                ]);
                const tools = createTelegramTools({ activeCompanyId, companies, chatId });
                const turn = await runAgentTurn({
                    messages: historyWithResult,
                    companies,
                    activeCompanyId,
                    userMemory,
                    tools,
                    geminiKey: cfg.geminiKey,
                    groqKey: cfg.groqKey,
                    cerebrasKey: cfg.cerebrasKey,
                    userId: uid,
                    chatId,
                    extraSystemContext: [categoriesBlock, suppliersBlock].filter(Boolean).join('\n\n'),
                });
                await deliverAgentResult(ctx, turn, historyWithResult, {
                    chatId,
                    uid,
                    companies,
                    activeCompanyId,
                    attachmentFileId: mutation.telegramFileId,
                    attachmentMime: mutation.telegramFileMime,
                    attachmentName: mutation.telegramFileName,
                });
            }
            catch {
                const fallbackHistory = [
                    ...historyWithResult,
                    { role: 'assistant', content: [{ type: 'text', text: result.message }] },
                ];
                await saveHistory(chatId, fallbackHistory);
                await ctx.reply(`${result.success ? '✅' : '⚠️'} ${result.message}`);
            }
        }
        finally {
            stopTyping();
        }
    });
    // ── Mensajes (texto / foto / PDF) ────────────────────────────────────
    bot.on('message', async (ctx) => {
        const chatId = ctx.chat.id;
        const uid = ctx.state.uid;
        const msg = ctx.message;
        if (msg.voice || msg.audio || msg.video || msg.video_note || msg.sticker) {
            await ctx.reply('Por ahora solo entiendo texto, fotos y PDFs 🙏');
            return;
        }
        const text = (msg.text ?? msg.caption ?? '').trim();
        let fileId = null;
        let fileMime = null;
        let fileName = null;
        if (msg.photo && msg.photo.length > 0) {
            fileId = msg.photo[msg.photo.length - 1].file_id;
            fileMime = 'image/jpeg';
            fileName = 'factura.jpg';
        }
        else if (msg.document) {
            const mime = msg.document.mime_type ?? '';
            if (!ALLOWED_DOC_MIMES.has(mime)) {
                await ctx.reply('Solo acepto fotos (JPG/PNG/WebP) o PDFs.');
                return;
            }
            fileId = msg.document.file_id;
            fileMime = mime;
            fileName = msg.document.file_name ?? (mime === 'application/pdf' ? 'documento.pdf' : 'imagen');
        }
        if (!text && !fileId)
            return;
        // Atajo: escribir "menu" (o "menú", en cualquier caja) abre el menú sin /.
        // Match exacto para no secuestrar frases legítimas dirigidas al agente.
        if (!fileId && text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === 'menu') {
            await updateChatState(chatId, { awaitingQuickEntry: null });
            await ctx.reply(MAIN_MENU_TEXT, { reply_markup: buildMainMenu() });
            return;
        }
        const stopTyping = startTyping(ctx);
        try {
            const [companies, state, rawHistory, userMemory, categoriesBlock, suppliersBlock] = await Promise.all([
                loadUserCompanies(uid),
                loadChatState(chatId),
                loadHistory(chatId),
                loadUserMemory(uid),
                loadCategoriesBlock(),
                loadSuppliersBlock(''),
            ]);
            if (companies.length === 0) {
                await ctx.reply('Tu usuario no tiene empresas activas en BusinessHub.');
                return;
            }
            // Registro rápido en curso: el texto es el monto + concepto. Corremos un
            // turno enfocado con tipo/proveedor/fecha bloqueados vía extraSystemContext;
            // el LLM emite createTransaction → tarjeta cf:/cx: normal.
            if (state.awaitingQuickEntry && text && !fileId) {
                const qeState = await loadQuickEntryState(state.awaitingQuickEntry, chatId);
                await updateChatState(chatId, { awaitingQuickEntry: null });
                if (!qeState || !qeState.payload.date) {
                    await ctx.reply('⌛ El registro expiró. Escribe /registrar para empezar de nuevo.');
                    return;
                }
                await patchCallbackState(qeState.stateId, { status: 'consumed' });
                const activeCompanyId = qeState.companyId;
                const userMessage = { role: 'user', content: [{ type: 'text', text }] };
                const tools = createTelegramTools({ activeCompanyId, companies, chatId });
                const turn = await runAgentTurn({
                    messages: [userMessage],
                    companies,
                    activeCompanyId,
                    userMemory,
                    tools,
                    geminiKey: cfg.geminiKey,
                    groqKey: cfg.groqKey,
                    cerebrasKey: cfg.cerebrasKey,
                    userId: uid,
                    chatId,
                    extraSystemContext: [categoriesBlock, suppliersBlock, quickEntryInstructions(qeState.payload)]
                        .filter(Boolean)
                        .join('\n\n'),
                });
                await deliverAgentResult(ctx, turn, [userMessage], {
                    chatId,
                    uid,
                    companies,
                    activeCompanyId,
                    attachmentFileId: null,
                    attachmentMime: null,
                    attachmentName: null,
                });
                return;
            }
            const history = await discardStalePending(ctx, chatId, state, rawHistory);
            let activeCompanyId = state.activeCompanyId ?? '';
            if (!companies.some((c) => c.id === activeCompanyId)) {
                activeCompanyId = companies[0].id;
                await updateChatState(chatId, {
                    activeCompanyId,
                    activeCompanyName: companies[0].name,
                });
            }
            // Contenido del mensaje del usuario (con adjunto como parte binaria
            // SOLO para este turno; al persistir se reemplaza por placeholder).
            const parts = [];
            let needsPdfNative = false;
            if (fileId && fileMime) {
                const downloaded = await downloadTelegramFile(cfg.token, fileId, {
                    mimeType: fileMime,
                    fileName: fileName ?? undefined,
                });
                if (fileMime === 'application/pdf') {
                    needsPdfNative = true;
                    parts.push({ type: 'file', data: downloaded.buffer, mimeType: 'application/pdf' });
                }
                else {
                    parts.push({ type: 'image', image: downloaded.buffer });
                }
                await updateChatState(chatId, {
                    latestAttachment: { fileId, mimeType: fileMime, fileName: fileName ?? 'archivo' },
                });
            }
            if (text || parts.length === 0) {
                parts.unshift({ type: 'text', text: text || '(sin texto)' });
            }
            const userMessage = { role: 'user', content: parts };
            const messages = [...history, userMessage];
            const tools = createTelegramTools({ activeCompanyId, companies, chatId });
            const turn = await runAgentTurn({
                messages,
                companies,
                activeCompanyId,
                userMemory,
                tools,
                geminiKey: cfg.geminiKey,
                groqKey: cfg.groqKey,
                cerebrasKey: cfg.cerebrasKey,
                userId: uid,
                chatId,
                needsPdfNative,
                extraSystemContext: [categoriesBlock, suppliersBlock].filter(Boolean).join('\n\n'),
            });
            const effectiveAttachment = fileId
                ? { fileId, mime: fileMime, name: fileName }
                : state.latestAttachment
                    ? {
                        fileId: state.latestAttachment.fileId,
                        mime: state.latestAttachment.mimeType,
                        name: state.latestAttachment.fileName,
                    }
                    : null;
            await deliverAgentResult(ctx, turn, messages, {
                chatId,
                uid,
                companies,
                activeCompanyId,
                attachmentFileId: effectiveAttachment?.fileId ?? null,
                attachmentMime: effectiveAttachment?.mime ?? null,
                attachmentName: effectiveAttachment?.name ?? null,
            });
        }
        catch (err) {
            if (err instanceof AllProvidersBusyError) {
                await ctx.reply('🤖 Los modelos de AI están saturados. Intenta de nuevo en un minuto.');
                return;
            }
            if (err instanceof TelegramFileError) {
                await ctx.reply(`⚠️ ${err.message}`);
                return;
            }
            console.error('[TelegramBot] message handler error:', err);
            const message = err instanceof Error ? err.message : 'Error desconocido';
            await ctx.reply(`⚠️ Algo falló procesando tu mensaje: ${message}`).catch(() => { });
        }
        finally {
            stopTyping();
        }
    });
    return bot;
}
//# sourceMappingURL=bot.js.map