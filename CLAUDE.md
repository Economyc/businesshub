# BusinessHub — Guía para Claude Code

Proyecto: plataforma interna multi-tenant de Bukz. Este archivo define stack, comandos, workflow y decisiones ya tomadas. Respetarlo evita retrabajo.

**Idioma:** toda comunicación y commits en español. Código e identificadores en inglés.

---

## 0. Design System — LEER ANTES DE CUALQUIER UI

**Obligatorio.** Antes de crear o modificar cualquier UI (componente, página, refactor visual), leer **`DESIGN_SYSTEM.md`** en la raíz del repo. Es la fuente única de verdad visual.

Aplica a:
- Código escrito por Claude en cualquier módulo
- Skills que generan o auditan UI: `/frontend-design`, `/aidesigner`, `/prompt-architect`, `/gsd:ui-phase`, `/gsd:ui-review`
- Subagentes (`Agent` tool) que toquen componentes, páginas o estilos
- Cualquier plantilla o generador automático

**Precedencia:** si una skill o agente trae sus propias convenciones (tipografía, escalas, paletas) y contradicen `DESIGN_SYSTEM.md`, **gana `DESIGN_SYSTEM.md`**.

Reglas duras (resumen; detalle completo en el doc):
- Tipografía en escalas fijas `text-caption/body/subheading/heading/kpi`. Nunca `text-2xl+` ni `font-bold`.
- Colores solo vía tokens (`bg-bone`, `text-graphite`, `bg-positive-bg`, etc.). Nunca hex hardcodeado.
- Spacing múltiplos de 4 (`gap-2/4/6`, `p-4/6`). Radius solo `rounded-lg/xl/2xl/full`.
- Sistema plano: cards sólo con borde 1px (`card-elevated` o `border-border/60`). Nada de `shadow-*` ni gradientes.
- Charts usan `src/core/ui/chart-colors.ts`.
- Antes de crear un componente nuevo, buscar primero en `src/components/ui/` y `src/core/ui/`.

---

## 1. Stack técnico

- **Frontend:** Vite + React 18.3 (SPA) + React Router v7
- **Lenguaje:** TypeScript 5.5 (strict)
- **UI:** shadcn + Tailwind CSS v4 (`@tailwindcss/vite`) + Radix UI + Base UI
- **Data/estado:** TanStack React Query v5
- **AI:** Vercel AI SDK (Google, Groq, Cerebras)
- **Backend:** Firebase — Firestore, Cloud Functions (Node 20), Auth, Storage
- **Package manager:** npm
- **Alias de imports:** `@/*` → `./src/*`
- **Proyecto Firebase:** `empresas-bf`

---

## 3. Comandos canónicos

### Desarrollo (raíz)
- `npm run dev` — Vite dev server
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm run build` — build producción
- `npm run test` — Vitest single run (unit)
- `npm run e2e` — Playwright E2E. Por defecto corre contra producción (`https://businesshub.myvnc.com`); override con `E2E_BASE_URL`. Credenciales del tester en `.env.e2e` (gitignoreado; ver `.env.e2e.example`). `npm run e2e:report` abre el reporte HTML. Specs en `e2e/`.
- MCP `playwright` está configurado en `.mcp.json` para testing interactivo de UI (navegar/clickear/screenshot) — requiere reiniciar Claude Code para que cargue.

### Deploy frontend (producción)
Usar el skill `/deploy-hub`. Hace push a GitHub + dispara el rebuild en Coolify (Hetzner) y espera el resultado. La app vive en **`https://hub.economyc.cc`**. No usar Firebase Hosting.

- El build corre **dentro de Coolify** (Dockerfile multi-stage), no en local.
- **No hay auto-deploy**: el `git push` solo no publica nada, hay que disparar el rebuild.
- `/deploy-oracle` quedó **obsoleto** (2026-08-12). Oracle (`businesshub.myvnc.com`) sigue vivo con el último bundle publicado, sólo como rollback: `bash deploy-oracle.sh`.
- App2 admin (`businessadm.economyc.cc`) es otro recurso del mismo repo, con `/Dockerfile.admin`.

### Deploy Cloud Functions
- **SIEMPRE** `gcloud functions deploy ...` para cada función.
- **NUNCA** `firebase deploy --only functions` ni `npm run deploy:functions`. firebase-tools ha fallado consistentemente en este proyecto; gcloud funciona. El script de npm existe pero está desaconsejado.

### Functions (carpeta `functions/`)
- `npm run build` — compila TS a `lib/`
- `npm run serve` — emulador local
- `npm run logs` — tail de Cloud Functions logs

---

## 6. Workflow estándar

### Antes de considerar una tarea completa
1. `npm run typecheck` — debe pasar (bloqueante)
2. `npm run lint` — no introducir errores nuevos
3. Cambios UI: abrir en `npm run dev` y verificar en navegador

### Antes de deploy
- `npm run build` debe pasar sin errores
- Solo deployar cuando el usuario lo pida explícitamente

### Commits
- Claude elige el mensaje (nunca pregunta).
- Formato: `tipo: descripción corta` — `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- En español
- Incluir trailer `Co-Authored-By` según protocolo git

### Planificación
- Cambios no triviales: usar `/plan` antes de implementar
- Tareas UI: considerar `/gsd:ui-phase` o `/frontend-design`
- Al terminar: mostrar resumen en lenguaje plano y preguntar si guardar y deployar

---

## 7. Decisiones ya tomadas (no reabrir)

### Arquitectura — no proponer alternativas salvo petición explícita
- Stack: Vite + React + Firebase. No migrar a Next.js, Remix, Supabase.
- UI: shadcn + Tailwind v4 + Radix. No introducir MUI, Chakra, Mantine.
- SPA con React Router v7. No convertir a SSR/SSG.

### Multi-tenant
- Scope por `CompanyProvider` / `useCompany()` → `selectedCompany`
- No existe campo `businessId` explícito — el scoping se hace vía contexto y queries
- Toda query de datos de negocio a Firestore debe filtrar por la company activa

### RBAC
- Sistema existente: `usePermissions()` + `PermissionRoute`
- Modelo: `CompanyMember` (role, status) + `RoleDefinition` (permisos por `ModuleKey`)
- No reinventar permisos. Nuevos módulos se integran al sistema existente.

### Estructura de módulos
- 13 módulos aislados en `src/modules/<nombre>/` con `routes.tsx` propio
- Lazy loading vía `Suspense` en `App.tsx`
- Módulos actuales: agent, analytics, closings, contracts, finance, home, marketing, notifications, partners, pos-sync, scheduled-reports, suppliers, talent
- UI compartida: `src/components/ui/` (shadcn)
- Servicios/hooks compartidos: `src/core/` y `src/lib/`

### Convenciones de código
- Componentes: PascalCase
- Hooks / servicios / utils: camelCase; hooks con prefijo `use*`
- Imports con alias `@/...` — evitar paths relativos largos

### Navegación
- Sidebar agrupado en secciones: **Contabilidad**, **Operaciones**, **Mercadeo**, **Integraciones**

### Design System
- Ver sección **0** al inicio de este archivo y `DESIGN_SYSTEM.md` en la raíz.
