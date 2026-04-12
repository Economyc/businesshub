# BusinessHub — Guía para Claude Code

Proyecto: plataforma interna multi-tenant de Bukz. Este archivo define stack, comandos, workflow y decisiones ya tomadas. Respetarlo evita retrabajo.

**Idioma:** toda comunicación y commits en español. Código e identificadores en inglés.

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
- `npm run test` — Vitest single run

### Deploy frontend (producción)
Usar el skill `/deploy-oracle`. Hace push a GitHub + build + deploy a Oracle Cloud (`http://134.65.233.213`). Es el único método de deploy de frontend. No usar Firebase Hosting.

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
- 16 módulos aislados en `src/modules/<nombre>/` con `routes.tsx` propio
- Lazy loading vía `Suspense` en `App.tsx`
- Módulos actuales: agent, analytics, cartera, closings, contracts, finance, home, marketing, notifications, partners, payroll, pos-sync, prestaciones, purchases, suppliers, talent
- UI compartida: `src/components/ui/` (shadcn)
- Servicios/hooks compartidos: `src/core/` y `src/lib/`

### Convenciones de código
- Componentes: PascalCase
- Hooks / servicios / utils: camelCase; hooks con prefijo `use*`
- Imports con alias `@/...` — evitar paths relativos largos

### Navegación
- Sidebar agrupado en secciones: **Finanzas**, **Operaciones**, **Personas**
