# BusinessHub — Design Specification

> ⚠️ **DEPRECADO (2026-04-13).** La fuente única de verdad visual es ahora **`/DESIGN_SYSTEM.md`** en la raíz del repo. Este archivo se conserva como contexto histórico; puede contener reglas obsoletas (ej. menciona Inter, la fuente real es Google Sans). No seguirlo para decisiones de diseño.

> Centro de mando unificado para el control ejecutivo de cuatro compañías independientes.

## 1. Overview

BusinessHub es una aplicación web SPA que consolida la gestión operativa de cuatro compañías independientes en un solo panel ejecutivo. Su filosofía es minimalismo absoluto: espacios amplios, tipografía técnica, y una paleta monocromática que prioriza la legibilidad sobre la decoración.

### Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18+ con Vite |
| Styling | Tailwind CSS |
| Componentes | Shadcn/ui (copiados al proyecto) |
| Animaciones | Framer Motion |
| Iconos | Lucide React (monocolor, stroke 1.5px) |
| Backend/DB | Firebase (Firestore) |
| Gráficos | Recharts |
| Routing | React Router v6 |
| Lenguaje | TypeScript |

### Usuarios

Solo el propietario/administrador por ahora. La arquitectura queda preparada para escalar a Firebase Auth con roles en el futuro.

## 2. Arquitectura

Monolito modular: un solo proyecto React con módulos aislados por dominio de negocio.

```
src/
  core/
    firebase/         — Config, inicialización, helpers Firestore
    ui/               — Design system: Layout, Sidebar, Topbar, KPICard, DataTable
    hooks/            — useCompany, useFirestore, useImport
    types/            — Types compartidos (Company, BaseEntity)
  modules/
    talent/
      components/     — EmployeeList, EmployeeForm, EmployeeProfile
      hooks/          — useEmployees, useEmployee
      services/       — talent.service.ts (CRUD Firestore)
      types/          — Employee type
      routes.tsx      — Rutas del módulo
    suppliers/
      components/     — SupplierList, SupplierForm, SupplierDetail
      hooks/          — useSuppliers, useSupplier
      services/       — suppliers.service.ts
      types/          — Supplier type
      routes.tsx
    finance/
      components/     — TransactionList, TransactionForm, ImportView
      hooks/          — useTransactions, useFinanceSummary
      services/       — finance.service.ts
      types/          — Transaction type
      routes.tsx
    insights/
      components/     — KPIDashboard, TrendChart, CategoryBreakdown
      hooks/          — useKPIs, useTrends
      services/       — insights.service.ts
      types/          — KPI, Trend types
      routes.tsx
  pages/              — Páginas de nivel superior (si se necesitan)
  App.tsx             — Router + CompanyProvider
  main.tsx            — Entry point
```

### Principios

- **Aislamiento por módulo**: cada módulo es autocontenido con sus propios componentes, hooks, servicios y tipos.
- **Contexto compartido**: `CompanyContext` provee la compañía seleccionada a todos los módulos. Cambiar compañía recarga los datos.
- **Firebase por compañía**: cada compañía = una colección raíz en Firestore. Datos totalmente aislados.
- **Lazy loading**: cada módulo se carga bajo demanda con `React.lazy()`.

## 3. Modelo de Datos — Firestore

```
companies/{companyId}
  ├── name: string
  ├── slug: string
  ├── createdAt: timestamp
  │
  ├── employees/{employeeId}
  │     ├── name: string
  │     ├── role: string
  │     ├── department: string
  │     ├── email: string
  │     ├── phone: string
  │     ├── salary: number
  │     ├── startDate: timestamp
  │     └── status: "active" | "inactive"
  │
  ├── suppliers/{supplierId}
  │     ├── name: string
  │     ├── category: string
  │     ├── contactName: string
  │     ├── email: string
  │     ├── phone: string
  │     ├── contractStart: timestamp
  │     ├── contractEnd: timestamp
  │     └── status: "active" | "expired" | "pending"
  │
  ├── transactions/{transactionId}
  │     ├── concept: string
  │     ├── category: string
  │     ├── amount: number
  │     ├── type: "income" | "expense"
  │     ├── date: timestamp
  │     ├── status: "paid" | "pending" | "overdue"
  │     └── notes: string (optional)
  │
  └── kpis/{period}          // "2026-03", "2026-Q1"
        ├── totalEmployees: number
        ├── totalSuppliers: number
        ├── totalIncome: number
        ├── totalExpenses: number
        ├── balance: number
        ├── topCategories: array
        └── trends: map
```

Cada compañía es un silo completo. No hay datos compartidos entre compañías.

## 4. Design System

### Paleta de Colores

| Token | Hex | Uso |
|-------|-----|-----|
| Bone White | `#f5f3f0` | Fondo principal |
| White | `#ffffff` | Tarjetas, sidebar, topbar |
| Smoke Gray | `#edebe8` | Bordes, separadores |
| Mid Gray | `#8a8a8a` | Texto secundario, captions |
| Graphite | `#3d3d3d` | Texto principal, iconos |
| Dark Graphite | `#2d2d2d` | Encabezados |
| Soft Green | `#e8f0e8` / `#5a7a5a` | Estado positivo / tendencia positiva |
| Warm Sand | `#f0ece4` / `#8a7a5a` | Estado pendiente / warning |
| Soft Red | `#f0e8e8` / `#9a6a6a` | Estado vencido / tendencia negativa |
| Soft Blue | `#e8ecf0` / `#5a6a8a` | Estado "en revisión" |

No hay colores vibrantes. Todos los acentos son desaturados.

### Tipografía

Fuente: **Inter** — técnica, limpia, excelente legibilidad en pantalla.

| Escala | Tamaño | Peso | Uso |
|--------|--------|------|-----|
| Heading | 18px | 600 (Semi-bold) | Títulos de módulo |
| Subheading | 14px | 500 (Medium) | Subtítulos, labels de sección |
| Body | 13px | 400 (Regular) | Texto general, tablas |
| Caption | 11px | 400 (Regular) | Labels KPI, headers de tabla (uppercase + tracking) |
| KPI Value | 22px | 600 (Semi-bold) | Números grandes en tarjetas KPI |

### Iconos

**Lucide React** — monocolor, línea fina (stroke-width: 1.5px), sin relleno.

| Icono | Componente Lucide | Contexto |
|-------|-------------------|----------|
| Insights | `BarChart3` | Navegación, KPI |
| Talento | `Users` | Navegación, empleados |
| Proveedores | `Briefcase` | Navegación, proveedores |
| Finanzas | `DollarSign` | Navegación, transacciones |
| Buscar | `Search` | Input de búsqueda |
| Nuevo | `Plus` | Botón crear |
| Editar | `Edit` | Acción editar |
| Eliminar | `Trash2` | Acción eliminar |
| Importar | `Upload` | Subir CSV/Excel |
| Exportar | `Download` | Descargar/exportar |
| Acceso | `LogIn` | Login |
| Config | `Settings` | Configuración |
| Usuario | `CircleUser` | Avatar/perfil |
| Tendencia ↑ | `ChevronUp` | KPI positivo |
| Tendencia ↓ | `ChevronDown` | KPI negativo |

### Componentes

**Botones:**
- Primary: fondo `#3d3d3d`, texto blanco, border-radius 10px
- Secondary: fondo `#edebe8`, texto grafito
- Ghost: transparente con borde `#e2e0dc`
- Todos: hover con `translateY(-1px)` + sombra sutil

**Tarjetas:**
- Fondo blanco, border-radius 12px, borde `#eeece9`
- Hover: `translateY(-2px)` + borde se oscurece + sombra expand

**Inputs:**
- Fondo `#faf9f7`, borde `#e2e0dc`, border-radius 10px
- Focus: borde `#b0ada8` + ring de 3px rgba(61,61,61,0.06)

**Badges de estado:**
- Border-radius 6px, padding 3px 10px, font-size 11px
- Colores según estado (verde/arena/rojo/azul, todos desaturados)

**Tablas de datos:**
- Header: fondo `#faf9f7`, texto uppercase 11px, color `#aaa`
- Filas: hover con fondo `#faf9f7`, bordes ultra-sutiles

### Animaciones — Framer Motion

| Contexto | Animación | Parámetros |
|----------|-----------|------------|
| Cambio de módulo | fadeIn + slideUp | y: 12→0, opacity: 0→1, 300ms ease-out |
| Cambio de compañía | crossfade | 150ms — datos se desvanecen y reaparecen |
| Tarjetas hover | lift + shadow | translateY: -2px, transition: 200ms |
| Botones hover | lift + shadow | translateY: -1px, transition: 200ms |
| Listas | staggered entrance | cada item +50ms delay |
| KPIs | count-up | número animado al cargar |
| Modales | scale + fade | scale: 0.95→1, opacity: 0→1, 200ms |

Todas las animaciones son sutiles y funcionales. Sin rebotes, sin exageraciones.

## 5. Layout Principal

```
┌──────────────────────────────────────────────────────┐
│  TOPBAR                                              │
│  [BusinessHub]    [A] [B] [C] [D]        ○ Admin    │
├────────┬─────────────────────────────────────────────┤
│        │  CONTENT AREA                               │
│ SIDEBAR│                                             │
│        │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│ ▸ Ins. │  │ KPI │ │ KPI │ │ KPI │ │ KPI │          │
│   Tal. │  └─────┘ └─────┘ └─────┘ └─────┘          │
│   Prov.│                                             │
│   Fin. │  ┌──────────────────────────────────┐      │
│        │  │         DATA TABLE               │      │
│        │  │                                  │      │
│        │  └──────────────────────────────────┘      │
│        │                                             │
└────────┴─────────────────────────────────────────────┘
```

- **Topbar**: logo a la izquierda, selector de compañía centrado (pills), usuario a la derecha
- **Sidebar**: navegación vertical con iconos Lucide + texto. Item activo con fondo `#f5f3f0` y borde derecho `#3d3d3d`
- **Content area**: KPIs en grid de 4 columnas + tablas/contenido del módulo activo

## 6. Módulos — Funcionalidades

### 6.1 Directorio de Talento (`/talent`)

- Listado de empleados en tabla con búsqueda y filtros (departamento, status)
- Crear nuevo empleado via formulario
- Editar empleado existente (en la misma vista de perfil, inline)
- Vista de perfil individual (`/talent/:id`) con modo lectura/edición
- Resumen de nómina total (suma de salarios activos)

### 6.2 Central de Proveedores (`/suppliers`)

- Listado de proveedores con filtros (categoría, status de contrato)
- Crear y editar proveedores (edición inline en la vista de detalle)
- Alerta visual en contratos próximos a vencer (< 30 días)
- Vista de detalle con datos del contrato (`/suppliers/:id`) con modo lectura/edición

### 6.3 Monitor Financiero (`/finance`)

- Tabla de transacciones con filtros: categoría, tipo (ingreso/gasto), status, rango de fechas
- Registro manual de transacciones via formulario
- Importación masiva desde CSV/Excel (`/finance/import`) con validación de columnas requeridas (concept, amount, type, date) y feedback de errores por fila
- Resumen superior: total ingresos, total gastos, balance

### 6.4 Panel de Insights (`/insights`)

- Dashboard principal (landing page)
- 4 tarjetas KPI: empleados, proveedores, gastos del mes, balance
- Gráfico de tendencia mensual (Recharts — line chart)
- Desglose de gastos por categoría (bar chart horizontal)
- Comparativa vs mes anterior con indicadores de tendencia
- Exportar reporte a PDF

## 7. Routing

| Ruta | Módulo | Carga |
|------|--------|-------|
| `/` | Redirect → `/insights` | instant |
| `/insights` | Panel de Insights | lazy |
| `/talent` | Listado empleados | lazy |
| `/talent/new` | Crear empleado | lazy |
| `/talent/:id` | Perfil empleado | lazy |
| `/suppliers` | Listado proveedores | lazy |
| `/suppliers/new` | Crear proveedor | lazy |
| `/suppliers/:id` | Detalle proveedor | lazy |
| `/finance` | Monitor financiero | lazy |
| `/finance/import` | Importar CSV/Excel | lazy |

Todas las rutas de módulo se cargan con `React.lazy()` + `Suspense`.

## 8. Dependencias Principales

```json
{
  "react": "^18.3",
  "react-dom": "^18.3",
  "react-router-dom": "^6",
  "firebase": "^10",
  "framer-motion": "^11",
  "lucide-react": "^0.400",
  "recharts": "^2",
  "tailwindcss": "^3",
  "typescript": "^5",
  "xlsx": "^0.18",
  "papaparse": "^5",
  "jspdf": "^2",
  "html2canvas": "^1"
}
```

- `xlsx` y `papaparse` para la importación de archivos Excel y CSV respectivamente
- `jspdf` y `html2canvas` para exportar reportes de Insights a PDF
- Shadcn/ui se instala via CLI y copia componentes al proyecto (no es una dependencia en package.json)

## 9. Decisiones de Diseño

1. **¿Por qué Monolito Modular?** — Para un solo usuario con 4 módulos, micro-frontends o monorepos añaden complejidad sin beneficio. La estructura modular permite migrar si escala.

2. **¿Por qué Firestore con subcolecciones?** — Aislamiento natural por compañía. Queries eficientes dentro de cada silo. No se necesitan joins cross-company.

3. **¿Por qué KPIs como colección?** — Se pueden calcular en tiempo real desde las otras colecciones, pero tener una colección `kpis/` permite pre-computar métricas para dashboards más rápidos y datos históricos. Los KPIs se calculan client-side al cargar el dashboard y se persisten en Firestore para historial. No se requieren Cloud Functions en esta fase.

4. **¿Por qué no auth ahora?** — Un solo usuario. Se prepara la arquitectura (CompanyContext separado de AuthContext) para añadir Firebase Auth sin refactorizar.

5. **¿Por qué Lucide monocolor?** — Coherencia con el minimalismo absoluto. Los emojis/iconos con color rompen la armonía visual de la paleta off-white/grafito.
