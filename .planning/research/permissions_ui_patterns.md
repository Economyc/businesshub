# Permissions & User Access Management UI/UX Patterns

**Domain:** SaaS permissions and access control for BusinessHub
**Researched:** 2026-04-05
**Overall confidence:** HIGH (well-documented domain, many real-world references)

---

## 1. User Management Screens

### User List View

The standard pattern across mature SaaS apps (Stripe, Notion, Linear, Google Workspace) is a **data table** with these columns:

| Column | Purpose | Component |
|--------|---------|-----------|
| Avatar + Name | Identity at a glance | Avatar + text |
| Email | Contact/invite identifier | Text (muted) |
| Role | Current assignment | Badge (colored by role) |
| Status | Active/Invited/Deactivated | Badge (green/yellow/red) |
| Last active | Engagement signal | Relative timestamp |
| Actions | Edit/Remove | Dropdown menu (MoreHorizontal icon) |

**Best practice:** Show a count header ("12 miembros del equipo") and provide a search/filter bar above the table. Filter by role and status.

**shadcn/ui implementation:** Use `DataTable` with `ColumnDef`, `Badge` for role/status, `DropdownMenu` for actions, `Avatar` for profile images.

### Invite Flow

The consensus pattern across Slack, Notion, and Linear:

1. **Trigger:** "Invitar miembro" button (top-right of user list)
2. **Modal/Sheet:** A `Dialog` or `Sheet` containing:
   - Email input (supports multiple emails, comma-separated)
   - Role selector (`Select` dropdown with role descriptions)
   - Optional: personal message field
3. **Confirmation:** Show summary before sending
4. **Post-invite:** User appears in table with "Invitado" status badge (yellow/amber)

**Anti-pattern:** Do NOT use a separate page for invitations. Keep it in a modal to maintain context.

**Anti-pattern:** Do NOT force role selection in a separate step. Combine email + role in one form.

### shadcn/ui Components

```
Dialog > DialogContent > Form
  - Input (email, with multi-email support)
  - Select (role picker with descriptions)
  - Button (submit)
```

---

## 2. Role Management

### Pre-defined Roles with Custom Extension

The proven pattern (Stripe, Google Workspace, QuickBooks):

**Built-in roles (not deletable, but viewable):**
| Role | Description | Color |
|------|-------------|-------|
| Propietario | Acceso total, gestiona facturacion | Slate/black |
| Administrador | Todo excepto facturacion y eliminacion de empresa | Purple |
| Gerente | Gestion operativa, reportes, equipo | Blue |
| Colaborador | Operaciones diarias (cierres, transacciones) | Green |
| Solo lectura | Ve todo, no edita nada | Gray |

**Custom roles:** Allow admins to create roles by cloning an existing role and modifying permissions. This is the "copy-from-existing" pattern recommended by Edwin Choate's case study.

### Role List UI

Display roles as **Cards** (not a table), because each role needs room for:
- Role name + badge color
- Description (1-2 lines)
- Member count ("5 miembros")
- Edit button
- Quick-view of top permissions

**Pattern:** Clicking a role card opens a `Sheet` (slide-over panel) with the full permission matrix for that role.

### shadcn/ui Components

```
Card grid (2-3 columns on desktop, 1 on mobile)
  Card > CardHeader (role name + Badge) > CardContent (description, member count)
  Sheet for editing (avoids full page navigation, maintains context)
```

---

## 3. Permission Matrix UI

### Recommended: Grouped Toggle Grid

This is the most effective pattern for SMB/mid-market SaaS (not the full NxN matrix used in enterprise tools, which overwhelms most users).

**Structure:**

```
[Module Group Header - e.g., "Contabilidad"]
  ┌─────────────────────┬──────┬──────┬──────┐
  │ Modulo              │  Ver │Editar│Borrar│
  ├─────────────────────┼──────┼──────┼──────┤
  │ Finanzas            │  ON  │  ON  │ OFF  │
  │ Cartera             │  ON  │  ON  │ OFF  │
  │ Cierres de Caja     │  ON  │  ON  │  ON  │
  │ Nomina              │  ON  │ OFF  │ OFF  │
  │ Prestaciones        │  ON  │ OFF  │ OFF  │
  └─────────────────────┴──────┴──────┴──────┘

[Module Group Header - e.g., "Gestion"]
  ┌─────────────────────┬──────┬──────┬──────┐
  │ Modulo              │  Ver │Editar│Borrar│
  ├─────────────────────┼──────┼──────┼──────┤
  │ Contratos           │  ON  │ OFF  │ OFF  │
  │ Socios              │  ON  │ OFF  │ OFF  │
  └─────────────────────┴──────┴──────┴──────┘
```

**Why toggles (Switch) over checkboxes:** Toggles communicate binary on/off state more clearly. Checkboxes imply multi-select scenarios. This distinction was validated in the Atasie Esther case study.

**Why grouped by navigation section:** Mirrors the sidebar structure the user already knows (Contabilidad, Gestion, Personas). This reduces cognitive load -- users can reason about permissions in the same mental model they use daily.

### Permission Levels

Use 3-4 permission levels per module, not more:

| Level | Meaning | Icon suggestion |
|-------|---------|-----------------|
| Ver | Can see the module and its data | Eye |
| Editar | Can create, modify records | Pencil |
| Borrar | Can delete records | Trash2 |
| Admin | Full control including settings | Shield |

**Dependency rule:** Editar requires Ver. Borrar requires Editar. Admin requires all.
When enabling Editar, auto-enable Ver. When disabling Ver, auto-disable everything below.

### Visual Feedback on Permission Changes

- **Unsaved changes indicator:** Show a sticky bottom bar with "Cambios sin guardar" + Save/Cancel buttons (like Notion's settings)
- **Destructive toggles:** When disabling a permission that affects active users, show an inline warning: "3 usuarios perderan acceso a Finanzas"
- **High-risk permissions:** Flag "Borrar" and "Admin" toggles with a subtle red/orange accent or a small ShieldAlert icon

### shadcn/ui Implementation

```
Accordion (one section per nav group)
  Table (module rows x permission columns)
    Switch (per cell)
  
Sticky bottom bar: div with fixed positioning
  Button variant="outline" (Cancel)
  Button variant="default" (Save)
```

---

## 4. Module Access Toggles

### Top-Level Module Visibility

For controlling which modules appear in the sidebar, use a simpler pattern than the full permission matrix:

```
┌─────────────────────────────────────────┐
│ Acceso a Modulos                        │
│                                         │
│ Home                     [ON] (locked)  │
│ Analisis                 [ON]           │
│ Finanzas                 [ON]           │
│ Cartera                  [OFF]          │
│ Cierres de Caja          [ON]           │
│ Contratos                [OFF]          │
│ ...                                     │
└─────────────────────────────────────────┘
```

**Key detail:** Some modules should be "locked on" (Home is always accessible). Show these with a disabled switch and a Lock icon + tooltip: "Este modulo es siempre visible".

### Relationship to Permission Matrix

Module access toggles control **page-level access** (the first layer). The permission matrix controls **operation-level access** (the second layer). This is the three-layer model from Perpetual's research:

1. **Page-level** - Can they see the module at all? (Module toggle)
2. **Operation-level** - What can they do inside? (Permission matrix)
3. **Data-level** - What records can they see? (Future: department/team scoping)

For BusinessHub's current stage, layers 1 and 2 are sufficient. Layer 3 is an enterprise feature to defer.

---

## 5. Visual Feedback for Locked/Unavailable Modules

### The Hide vs. Disable Decision

Based on Smashing Magazine's comprehensive analysis, the correct approach for BusinessHub:

**For modules the user CANNOT access due to their role:**
- **Show but disable** the sidebar item (greyed out, 40% opacity)
- Show a **Lock icon** next to the module name
- On hover/click: show a **Tooltip** explaining why: "No tienes acceso a este modulo. Contacta a tu administrador."
- Do NOT hide the module entirely

**Rationale:** Hiding modules means users don't know the feature exists. This hurts discoverability and creates confusion ("I heard BusinessHub has X, where is it?"). Showing disabled items lets users understand the product's full scope and request access when needed.

**Exception - when to HIDE:**
- If the module is irrelevant to the user's job function entirely (e.g., a pure Viewer role might not need to see admin-only settings)
- If showing the module creates security concerns (users shouldn't even know it exists)

### Implementation Pattern

```tsx
// Sidebar item for restricted module
<SidebarMenuItem>
  <SidebarMenuButton disabled className="opacity-40 cursor-not-allowed">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <ModuleIcon className="h-4 w-4" />
            <span>Nomina</span>
            <Lock className="h-3 w-3 ml-auto" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          No tienes acceso a este modulo
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </SidebarMenuButton>
</SidebarMenuItem>
```

### Route Protection

Even if the sidebar item is hidden/disabled, always protect routes:
- Redirect unauthorized users to a **403 page** with a clear message and a "Solicitar acceso" button
- Never show a blank page or a generic error

---

## 6. Patterns from Real Apps

### Stripe Dashboard
- **5 built-in roles** with progressive restriction (Admin > Developer > Analyst > Support > Read-only)
- Permissions grouped by **functional area** (API access, Settings, Financial data, Actions)
- Role assignment via centralized **Settings > Team** page
- Granular per-area permissions within each role
- **Takeaway:** Pre-built roles with clear descriptions work better than asking admins to build from scratch

### Notion
- **Workspace-level roles:** Owner, Admin, Member, Guest
- **Page-level sharing:** Independent of workspace role
- Settings accessed via **slide-over panels**, not full pages
- **Takeaway:** Two-tier permissions (workspace + resource) reduces complexity. Side panels maintain context.

### Linear
- **Organization-wide roles** (Owner, Admin, Member, Guest)
- **Team-level access** controls which projects a user sees
- Clean, minimal settings UI with toggle switches
- **Takeaway:** Team-based scoping is elegant for multi-department businesses

### Slack
- **Workspace Owner/Admin/Member/Guest** hierarchy
- Channel-level permissions (public/private/restricted)
- Admin settings in a dedicated web portal (not in the app)
- **Takeaway:** Separating admin settings into a dedicated area keeps the main app clean

### Google Workspace
- **Organizational Units** for grouping users
- **Admin Console** as separate application
- Granular service-level toggles (enable/disable Gmail, Drive, etc. per OU)
- **Takeaway:** Module-level toggles per group are the enterprise standard

### QuickBooks
- **Pre-defined roles** (Master Admin, Company Admin, Standard, Reports-only, Time tracking only)
- **Area-based permissions** with three levels: None / View only / Full access
- Simple dropdown selectors per area instead of checkboxes
- **Takeaway:** For accounting software specifically, area-based dropdowns (None/View/Full) are simpler than toggle matrices

### Recommendation for BusinessHub

Adopt the **Stripe/QuickBooks hybrid model**:
- Pre-defined roles with clear names and descriptions (like Stripe)
- Module-grouped permission matrix with toggle switches (cleaner than QuickBooks dropdowns for a modern UI)
- Side panel editing (like Notion) to maintain context
- Module visibility control in the sidebar (like Google Workspace)

---

## 7. Common Anti-Patterns

### Critical Anti-Patterns (cause user frustration or security issues)

| Anti-Pattern | Why It Fails | What To Do Instead |
|---|---|---|
| **Giant NxN matrix on one screen** | Overwhelming for non-technical admins. Scroll fatigue, error-prone | Group by module/section, use collapsible sections |
| **No default roles** | Forces every admin to build roles from scratch | Provide 4-5 sensible defaults that cover 80% of use cases |
| **Hide-only approach** | Users don't know features exist, can't request access | Show disabled with tooltip explanation |
| **Immediate permission changes without confirmation** | Accidental clicks remove access | Use "Save changes" pattern with unsaved changes warning |
| **No audit trail** | Admins can't see who changed what | Log all permission changes with timestamp + actor |
| **Overly granular permissions** | 50+ individual toggles per role overwhelm admins | Group into meaningful levels (Ver/Editar/Borrar/Admin) |
| **Same UI for all permission levels** | Admin doesn't know which permissions are "dangerous" | Visually flag destructive permissions (delete, admin) |
| **No "what will happen" preview** | Admin doesn't know impact of changes | Show affected user count before saving |

### Moderate Anti-Patterns

| Anti-Pattern | Why It Fails | What To Do Instead |
|---|---|---|
| **Permission names use developer jargon** | "CRUD_WRITE" means nothing to a business admin | Use plain language: "Editar transacciones" |
| **No way to duplicate/clone a role** | Admins recreate similar roles from scratch every time | "Duplicar" button on each role card |
| **Role assignment only from user detail page** | Bulk role changes require visiting each user individually | Allow role assignment from the user list (batch actions) |
| **No search in permission matrix** | Large matrices become unusable | Add a filter/search bar above the matrix |
| **Permissions page is separate from role page** | Mental disconnect between role definition and its permissions | Show permissions inline when editing a role |

---

## 8. Mobile-Friendly Patterns

### Permission Matrix on Small Screens

The NxN grid is the biggest challenge on mobile. Recommended approaches:

**Pattern 1: Card-based collapse (RECOMMENDED for BusinessHub)**
- Each module becomes a card
- Tap to expand and see its permission toggles vertically
- Permissions stack as labeled switches instead of grid columns

```
Mobile layout:
┌─────────────────────────────┐
│ Finanzas                  v │  <- tap to expand
├─────────────────────────────┤
│  Ver           [====ON====] │
│  Editar        [====ON====] │
│  Borrar        [===OFF====] │
│  Admin         [===OFF====] │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Cartera                   > │  <- collapsed
└─────────────────────────────┘
```

**Pattern 2: Horizontal scroll with sticky first column**
- Keep module names visible while scrolling permission columns
- Works but is less intuitive on small screens

**Pattern 3: Role comparison view**
- Show one role at a time with a role switcher at the top
- Best for comparing "what does this role have access to?"

### User List on Mobile

- Replace the full data table with a **list of cards**
- Each card shows: Avatar, Name, Role (badge), Status indicator
- Tap to open detail sheet with edit actions
- Filter by role using horizontal scrolling pill buttons

### shadcn/ui Mobile Components

```
Accordion (for collapsible permission cards)
Sheet (for editing, slides up from bottom on mobile)
ScrollArea (for horizontal scrolling if needed)
Tabs (for switching between Users/Roles views)
```

---

## 9. shadcn/ui Component Mapping

### Complete Component Inventory for Permissions Module

| UI Element | shadcn/ui Component | Usage |
|---|---|---|
| User list | DataTable | Main users view with sorting/filtering |
| Role badges | Badge | Color-coded role indicators |
| Status indicators | Badge variant | Active (green), Invited (yellow), Inactive (gray) |
| Permission toggles | Switch | Individual permission on/off |
| Module groups | Accordion | Collapsible sections in permission matrix |
| Role cards | Card | Role list display |
| Invite modal | Dialog | User invitation flow |
| Role editor | Sheet | Slide-over panel for editing role permissions |
| Confirmation | AlertDialog | Destructive action confirmations |
| Action menus | DropdownMenu | Per-user/per-role actions |
| Role selector | Select | Dropdown for role assignment |
| Search/filter | Input + Button | Filter users or permissions |
| Form validation | Form (react-hook-form + zod) | Invite form, role creation form |
| Locked module indicator | Tooltip | "No tienes acceso" explanation |
| Unsaved changes bar | Custom sticky div | Save/Cancel pending changes |
| Empty states | Custom with illustration | "No hay usuarios invitados" |
| Tabs | Tabs | Switch between Users/Roles/Activity views |
| Avatar | Avatar | User profile images with fallback initials |

### Recommended Page Structure

```
/settings/team (or /equipo)
  Tabs:
    [Miembros] - DataTable of users + invite button
    [Roles]    - Card grid of roles + create role button
    [Actividad] - Audit log of permission changes (future)

  Editing a role (Sheet slide-over):
    Role name input
    Role description textarea
    Accordion per module group:
      Table with Switch toggles per permission level
    Sticky save bar at bottom
```

---

## 10. Data Model Considerations

### Recommended Permission Structure

```typescript
// Permission levels for each module
type PermissionLevel = 'none' | 'view' | 'edit' | 'delete' | 'admin';

// A role defines permissions per module
interface Role {
  id: string;
  name: string;           // "Administrador"
  description: string;    // "Acceso total excepto facturacion"
  color: string;          // For Badge display
  isSystem: boolean;      // true = built-in, can't delete
  permissions: Record<ModuleKey, PermissionLevel>;
}

// Module keys match the sidebar/routing structure
type ModuleKey =
  | 'home' | 'analytics' | 'agent'
  | 'finance' | 'cartera' | 'closings' | 'payroll' | 'prestaciones'
  | 'contracts' | 'partners'
  | 'talent' | 'suppliers'
  | 'settings';

// User has one role (keep it simple)
interface TeamMember {
  id: string;
  userId: string;         // Firebase Auth UID
  email: string;
  displayName: string;
  role: string;           // Role ID
  status: 'active' | 'invited' | 'deactivated';
  invitedAt: Timestamp;
  lastActiveAt: Timestamp;
}
```

**Why single role per user (not multi-role):** Multi-role creates permission merging complexity (which role wins on conflicts?). For an SMB tool like BusinessHub, one role per user is simpler to implement and understand. If needed later, custom roles provide the same flexibility.

### Firestore Structure

```
companies/{companyId}/roles/{roleId}        - Role definitions
companies/{companyId}/members/{memberId}    - Team members
companies/{companyId}/audit/{auditId}       - Permission change log
```

---

## 11. Implementation Priority

### Phase 1: Foundation (Must Have)
1. Role definitions in Firestore with default roles
2. User list page with DataTable
3. Invite flow (email + role assignment)
4. Basic permission checking in routes (redirect if no access)
5. Sidebar shows/hides modules based on role

### Phase 2: Full Matrix (Should Have)
1. Permission matrix UI with grouped toggles
2. Custom role creation (clone + modify)
3. Unsaved changes bar with impact preview
4. Disabled sidebar items with tooltips for restricted modules
5. 403 page with "Solicitar acceso"

### Phase 3: Polish (Nice to Have)
1. Audit log of permission changes
2. Bulk role assignment from user list
3. Role comparison view
4. Activity indicators (last active)
5. Mobile-optimized permission editing

---

## Sources

- [Perpetual: How to Design Effective SaaS Roles and Permissions](https://www.perpetualny.com/blog/how-to-design-effective-saas-roles-and-permissions) - Three-layer permission model
- [Rina Artstain: How to Design a Permissions Framework](https://rinaarts.com/how-to-design-a-permissions-framework/) - Framework architecture
- [Edwin Choate: Roles & Permissions Redesign](https://edwinchoate.com/articles/roles-permissions-redesign/) - Copy-from-existing pattern, labeling best practices
- [Smashing Magazine: Hidden vs. Disabled in UX](https://www.smashingmagazine.com/2024/05/hidden-vs-disabled-ux/) - When to hide vs. grey out
- [Stripe: New Roles and Permissions](https://stripe.com/blog/new-roles-and-permissions-in-the-dashboard) - Progressive role hierarchy
- [Stripe: User Roles Documentation](https://docs.stripe.com/get-started/account/teams/roles) - Granular role definitions
- [EnterpriseReady: RBAC Guide](https://www.enterpriseready.io/features/role-based-access-control/) - Enterprise RBAC patterns
- [UX Design (Medium): Designing Permissions for SaaS](https://uxdesign.cc/design-permissions-for-a-saas-app-db6c1825f20e) - Flattened user type model
- [shadcn/ui: Account Permissions Block](https://www.shadcn.io/blocks/account-permissions) - Component patterns
- [shadcn/ui: Data Table](https://ui.shadcn.com/docs/components/radix/data-table) - Table implementation
- [Nicelydone: User Permissions Patterns](https://nicelydone.club/tags/user-permissions) - 189+ real-world UI examples
- [Atasie Esther: Custom Role Creation Case Study](https://tassyomah.medium.com/custom-role-creation-and-permission-management-feature-case-study-acd4f4cb7ac3) - Toggles vs checkboxes rationale
