# BusinessHub — Design System

Fuente única de verdad visual. **Leer antes de crear o modificar cualquier UI.** Aplica a todo código nuevo, skills (`/frontend-design`, `/gsd:ui-phase`) y refactors.

La implementación de tokens vive en `src/index.css` (Tailwind v4 `@theme`). Este documento explica **cómo usarlos**.

---

## 1. Principios

1. **Monocromático cálido.** Paleta bone/graphite (beige hueso + grafito). El color funcional (verde/ámbar/rojo/azul) sólo para estado, nunca decorativo.
2. **Denso pero respirado.** Información densa; aire consistente (spacing de 4 en 4). No hay "hero sections" en dashboards.
3. **Sin decoración.** Nada de gradientes, sombras pesadas, iconos grandes decorativos, tipografía gigante. La elegancia viene de simetría y escala.
4. **Simetría.** Grids alineadas, cards del mismo alto, paddings iguales. La asimetría es un bug.
5. **Iconos Lucide stroke 1.5** tamaño 16–20px. Nunca >24px salvo empty states.

---

## 2. Tipografía

**Fuente:** `Google Sans` (via `--font-sans`). Siempre heredada — no aplicar `font-*` custom.

**Escalas permitidas** (clases Tailwind v4 generadas por `@theme`):

| Clase | Tamaño | Uso |
|---|---|---|
| `text-caption` | 12px | Labels, metadatos, ayudas |
| `text-body` | 14px | Texto corrido (default en body) |
| `text-subheading` | 16px | Títulos de card, tabs activos |
| `text-heading` | 20px | Títulos de página / sección |
| `text-kpi` | 26px | Valor numérico principal de KPI |

**Pesos:** `font-normal` (400) para body, `font-medium` (500) para títulos, `font-semibold` (600) para KPI values. Nada de `font-bold`/`font-black`.

**Prohibido:**
- `text-2xl`, `text-3xl`, `text-4xl`+ (cualquier tamaño > 26px)
- Mezclar fuentes
- `uppercase` en títulos (sólo en labels tipo `text-caption` muy puntuales)

---

## 3. Color

**Usar SIEMPRE tokens.** Nunca hex hardcodeado en JSX/TSX (ni en charts — ver §7).

### Neutros
| Token Tailwind | Uso |
|---|---|
| `bg-surface` | Fondo base de app |
| `bg-bone` | Fondo secundario, hovers sutiles |
| `bg-smoke` | Separadores, skeleton |
| `bg-card-bg` | Fondo de card |
| `text-graphite` | Texto principal |
| `text-dark-graphite` | Títulos, énfasis |
| `text-mid-gray` | Texto secundario / metadata |
| `border-border` | Bordes default (usar `/60` para suave) |
| `border-border-hover` | Bordes en hover |

### Funcionales (estado)
| Par | Uso |
|---|---|
| `bg-positive-bg text-positive-text` | Éxito, crecimiento, OK |
| `bg-warning-bg text-warning-text` | Advertencia, pendiente |
| `bg-negative-bg text-negative-text` | Error, decrecimiento |
| `bg-info-bg text-info-text` | Informativo, neutral con énfasis |

**Regla:** si un color no está arriba, no existe.

---

## 4. Spacing

Múltiplos de 4 (escala Tailwind default). Valores canónicos:

- **Gaps entre secciones:** `space-y-6` o `gap-6`
- **Gaps dentro de card:** `space-y-4` o `gap-4`
- **Gaps de chips/inline:** `gap-2`
- **Padding card pequeña:** `p-4`
- **Padding card principal:** `p-6`
- **Padding página:** `p-6 lg:p-8` (máximo)

No usar `p-3`, `p-5`, `p-7`, `gap-5`, etc. Si necesitas valores raros, revisa tu layout.

---

## 5. Radius

| Clase | Uso |
|---|---|
| `rounded-lg` | Botones, inputs, selects |
| `rounded-xl` | Cards (default) |
| `rounded-2xl` | Cards destacadas / contenedores grandes |
| `rounded-full` | Avatars, badges tipo pill, toggles |

No usar `rounded-md`, `rounded-sm`, `rounded-3xl`+.

---

## 6. Elevación

Sólo 2 niveles:

1. **Card principal:** clase `card-elevated` (sombra sutil + un solo borde 1px). Definida en `src/index.css`.
2. **Card secundaria:** `border border-border/60 bg-card-bg`. Sin sombra.

**Borde delgado (1px real).** `card-elevated` aplica un único `border: 1px solid var(--color-border)` y una sombra suave. No duplicar el borde con un `box-shadow` tipo `0 0 0 1px var(--color-border)` — ese patrón visualmente suma 2px y engrosa el edge. La intención del sistema es un borde delgado y sobrio.

Nada de `shadow-md/lg/xl/2xl`. Si crees necesitar más elevación, probablemente sobra un nivel de anidación.

---

## 7. Charts (gráficos)

**Prohibido hex hardcodeado.** Usar helper `src/core/ui/chart-colors.ts` que expone:

```ts
import { chartColors } from "@/core/ui/chart-colors";
chartColors.positive   // var(--app-positive-text)
chartColors.negative   // var(--app-negative-text)
chartColors.neutral    // var(--app-mid-gray)
chartColors.muted      // var(--app-border)
chartColors.grid       // var(--app-border)
chartColors.text       // var(--app-mid-gray)
```

Estos valores son CSS vars — funcionan en dark mode sin cambios adicionales.

---

## 8. Componentes

### Primitivos shadcn (`src/components/ui/`)

Usar siempre los primitivos antes de improvisar:

- `Button` — variantes: `default`, `outline`, `ghost`, `secondary`, `destructive`, `link`. Tamaños: `sm`, `default`, `lg`, `icon`.
- `Card` / `CardHeader` / `CardContent` / `CardFooter`
- `Badge` — variantes: `default`, `positive`, `warning`, `negative`, `info`, `outline`
- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`
- `Alert` — variantes: `default`, `positive`, `warning`, `negative`, `info`
- `Dialog`, `Popover`, `Select`, `Input`, `Table`, `Tooltip`
- `DropdownMenu`, `Accordion`

### Componentes core (`src/core/ui/`)

- `KPICard` — SIEMPRE para métricas destacadas. No reinventar.
- `DataTable` — listados tabulares.
- `Breadcrumb`, `Sidebar`, `Avatar`, `CommandPalette`, etc.

**Regla:** antes de crear un componente nuevo, buscar en `src/core/ui/` y `src/components/ui/`.

---

## 9. Layout

### Grids de KPIs
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
  {/* KPICards con h-full para altura uniforme */}
</div>
```

### Página típica
```tsx
<div className="space-y-6 p-6 lg:p-8">
  <header>{/* text-heading + acciones */}</header>
  <section>{/* KPIs */}</section>
  <section>{/* contenido principal */}</section>
</div>
```

- Cards de misma fila = mismo alto (`h-full` o grid `auto-rows-fr`).
- Nunca mezclar radius/paddings distintos en la misma fila.

---

## 10. Dark mode

Se activa con clase `dark` en `<html>`. Todos los tokens de §3 funcionan automáticamente — no escribir `dark:bg-*` custom salvo casos MUY justificados. Si necesitas `dark:` custom, es señal de que estás saliéndote del sistema.

---

## 11. Anti-patrones (lista negra)

Rompen el sistema. Rechazar en review:

- ❌ `text-3xl`, `text-4xl`, `text-5xl` en dashboards
- ❌ `font-bold`, `font-black`
- ❌ Colores hex hardcodeados (`#5a7a5a`, `#fff`, `rgb(...)`)
- ❌ `shadow-lg`, `shadow-xl`, gradientes (`bg-gradient-*`)
- ❌ `box-shadow: 0 0 0 1px ...` duplicando el `border` (engrosa el edge a 2px)
- ❌ Emojis como iconos decorativos
- ❌ `p-3`, `p-5`, `gap-5`, `space-y-5` (valores fuera de la escala)
- ❌ Cards con alturas desiguales en la misma fila
- ❌ Iconos > 24px fuera de empty states
- ❌ Fuente distinta a Google Sans
- ❌ `dark:bg-*` cuando ya existe token neutro
- ❌ Crear componente en el módulo cuando existe en `src/core/ui/` o `src/components/ui/`

---

## 12. Checklist antes de dar un cambio UI por terminado

1. ¿Todos los tamaños de texto son de la tabla §2?
2. ¿Todos los colores son tokens §3?
3. ¿Spacings son múltiplos de 4 y de la lista §4?
4. ¿Radius de la lista §5?
5. ¿Cards de la misma fila tienen el mismo alto?
6. ¿Charts usan `chart-colors.ts`?
7. ¿Funciona en dark mode sin overrides?
8. ¿Usé primitivos existentes antes de crear algo nuevo?
9. `npm run typecheck` y `npm run lint` pasan.
