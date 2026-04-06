# Permissions & Access Control Research for BusinessHub

**Domain:** Multi-module SaaS business management app (React + Firebase/Firestore)
**Researched:** 2026-04-05
**Overall confidence:** HIGH

---

## Executive Summary

BusinessHub currently has zero permissions enforcement -- any authenticated user has full access to all companies and all modules. Implementing access control requires a **hybrid approach**: store per-company role memberships in Firestore documents (not custom claims alone), enforce access in Firestore Security Rules, and mirror minimal role info into Firebase custom claims for fast client-side gating.

The recommended model is **RBAC with module-level permissions** -- simple enough to implement incrementally, flexible enough to cover the multi-company, multi-module needs of a business management app. ABAC is overkill for this use case. Pure custom-claims-based RBAC hits the 1000-byte limit fast when a user belongs to multiple companies.

---

## 1. Access Control Model: RBAC with Module Permissions

### Recommendation: RBAC (not ABAC, not PBAC)

**Use RBAC because:**
- BusinessHub has clear, stable module boundaries (finance, payroll, talent, contracts, etc.)
- The user base is small-to-medium businesses where roles are well-defined (owner, accountant, HR manager, employee)
- RBAC is straightforward to implement in Firestore Security Rules
- All major competitors (QuickBooks, Xero, Gusto, BambooHR) use RBAC as their core model

**Do not use ABAC because:**
- ABAC requires evaluating attributes at runtime (time of day, IP, resource sensitivity) -- unnecessary complexity for BusinessHub
- Firestore Security Rules cannot efficiently evaluate arbitrary attributes
- The app doesn't need context-dependent access policies

**Do not use PBAC because:**
- Policy-based access control requires a policy engine (OPA, Cedar) -- adds infrastructure overhead
- No current requirement for policies beyond "who can access what module with what actions"

**Confidence:** HIGH -- multiple sources confirm RBAC is the standard for business management SaaS apps of this size.

### Role Hierarchy

Based on analysis of QuickBooks, Xero, Gusto, and BambooHR, here is the recommended role structure:

| Role | Description | Typical User |
|------|-------------|-------------|
| `owner` | Full access to everything including billing, company settings, user management | Business owner / founder |
| `admin` | Full access to all modules, can manage users but not billing/company deletion | Operations manager, trusted partner |
| `finance` | Access to finance, purchases, closings, analytics, suppliers, cartera | Accountant, bookkeeper |
| `hr` | Access to talent, payroll, prestaciones, contracts | HR manager |
| `manager` | Read access to analytics + limited access to their team's talent/payroll data | Department manager |
| `employee` | Self-service only: view own payroll, contracts, request time off | Regular employee |
| `viewer` | Read-only access to specified modules | External auditor, advisor |

### Module Permission Matrix

Each role maps to a set of module permissions. Each module permission specifies CRUD granularity:

```typescript
type ModulePermission = {
  module: string
  actions: ('read' | 'create' | 'update' | 'delete')[]
}

// Example: "finance" role
const financePermissions: ModulePermission[] = [
  { module: 'finance',    actions: ['read', 'create', 'update', 'delete'] },
  { module: 'purchases',  actions: ['read', 'create', 'update', 'delete'] },
  { module: 'closings',   actions: ['read', 'create', 'update', 'delete'] },
  { module: 'analytics',  actions: ['read'] },
  { module: 'suppliers',  actions: ['read', 'create', 'update', 'delete'] },
  { module: 'cartera',    actions: ['read', 'create', 'update', 'delete'] },
  { module: 'partners',   actions: ['read'] },
]
```

**Confidence:** MEDIUM -- module groupings are based on competitor analysis and common business app patterns. Exact module-to-role mapping should be validated with real users.

---

## 2. Firestore Data Architecture for Permissions

### The Custom Claims Problem

Firebase custom claims are limited to **1000 bytes**. For a user who belongs to 3 companies with different roles, the claims payload quickly exceeds this:

```json
// This WILL exceed 1000 bytes with 4+ companies
{
  "companies": {
    "companyA": { "role": "owner", "modules": ["finance","payroll","talent","contracts","analytics","closings","purchases","suppliers","cartera","partners","prestaciones"] },
    "companyB": { "role": "finance", "modules": ["finance","purchases","closings","analytics","suppliers","cartera"] },
    "companyC": { "role": "hr", "modules": ["talent","payroll","prestaciones","contracts"] }
  }
}
```

### Recommended Architecture: Firestore Membership Documents + Minimal Custom Claims

**Custom claims (kept under 1000 bytes):**
```json
{
  "companies": ["companyIdA", "companyIdB", "companyIdC"]
}
```

Only store the list of company IDs the user has access to. This enables Firestore Security Rules to verify company membership without a document read.

**Firestore membership documents (detailed permissions):**

```
/companies/{companyId}/members/{userId}
{
  role: "finance",              // predefined role name
  permissions: [...],           // optional: custom overrides per module
  invitedBy: "ownerUserId",
  invitedAt: Timestamp,
  joinedAt: Timestamp,
  status: "active"              // "active" | "suspended" | "pending"
}
```

**Why this split:**
1. Custom claims = fast, no-read-needed check for "does user belong to this company?"
2. Firestore member doc = detailed role + permissions, read once per session and cached client-side
3. Security rules can check `request.auth.token.companies` array for company-level access, then `get()` the member doc for role-level checks on sensitive operations

### Predefined Roles Collection

Store role definitions as configuration so they can be updated without code changes:

```
/settings/roles
{
  definitions: {
    owner: {
      label: "Propietario",
      permissions: [
        { module: "finance", actions: ["read","create","update","delete"] },
        { module: "payroll", actions: ["read","create","update","delete"] },
        // ... all modules with full access
      ],
      canManageUsers: true,
      canManageCompany: true,
      canDeleteCompany: true,
    },
    admin: {
      label: "Administrador",
      permissions: [...],
      canManageUsers: true,
      canManageCompany: true,
      canDeleteCompany: false,
    },
    finance: {
      label: "Finanzas",
      permissions: [...],
      canManageUsers: false,
      canManageCompany: false,
    },
    // ... etc
  }
}
```

### Firestore Schema Summary

```
/companies/{companyId}/                    -- company data (existing)
/companies/{companyId}/members/{userId}    -- NEW: role membership
/companies/{companyId}/invitations/{id}    -- NEW: pending invitations
/settings/roles                            -- NEW: role definitions (global)
```

**Confidence:** HIGH -- this is the pattern recommended by Firebase's own documentation (Doug Stevenson's articles on Firebase Developers blog) and works within the 1000-byte custom claims limit.

---

## 3. Firestore Security Rules

### Current State

The project has NO Firestore security rules file (only `storage.rules`). This means Firestore is either open to all authenticated users or using default deny rules from the Firebase console.

### Recommended Security Rules Structure

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================
    // Helper functions
    // ============================================

    // Check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }

    // Check if user belongs to this company (via custom claims)
    function isMember(companyId) {
      return isSignedIn()
        && companyId in request.auth.token.companies;
    }

    // Get user's membership document for this company
    function getMembership(companyId) {
      return get(/databases/$(database)/documents/companies/$(companyId)/members/$(request.auth.uid));
    }

    // Check if user has a specific role in this company
    function hasRole(companyId, role) {
      return isMember(companyId)
        && getMembership(companyId).data.role == role;
    }

    // Check if user has any of the specified roles
    function hasAnyRole(companyId, roles) {
      return isMember(companyId)
        && getMembership(companyId).data.role in roles;
    }

    // Check if user is owner or admin
    function isAdminOrOwner(companyId) {
      return hasAnyRole(companyId, ['owner', 'admin']);
    }

    // ============================================
    // Company-level rules
    // ============================================
    match /companies/{companyId} {
      // Any member can read company info
      allow read: if isMember(companyId);
      // Only owner can update company settings
      allow update: if hasRole(companyId, 'owner');
      // Only owner can delete company
      allow delete: if hasRole(companyId, 'owner');

      // Members subcollection
      match /members/{userId} {
        // Members can read their own membership
        allow read: if isMember(companyId);
        // Only admin/owner can write memberships
        allow write: if isAdminOrOwner(companyId);
      }

      // Invitations subcollection
      match /invitations/{inviteId} {
        allow read: if isMember(companyId);
        allow create: if isAdminOrOwner(companyId);
        allow update, delete: if isAdminOrOwner(companyId);
      }

      // All other subcollections (transactions, employees, etc.)
      match /{subcollection}/{docId} {
        // Read: any member of the company
        allow read: if isMember(companyId);
        // Write: admin/owner always, others need module-level checks
        // NOTE: For module-level CRUD checks, use Cloud Functions
        // instead of rules (rules get too complex for per-module checks)
        allow write: if isAdminOrOwner(companyId);
      }
    }

    // Global settings
    match /settings/{settingId} {
      allow read: if isSignedIn();
      // Only allow writes from Cloud Functions (admin SDK bypasses rules)
      allow write: if false;
    }
  }
}
```

### Important Security Rules Constraints

1. **10 document reads per rule evaluation** -- Firestore rules can call `get()` or `exists()` at most 10 times per rule evaluation. The membership check uses 1 read, leaving 9 for other checks.
2. **Rules are not filters** -- You cannot query all documents and expect rules to filter out unauthorized ones. Clients must query within their authorized scope.
3. **Module-level CRUD checks in rules become unwieldy** -- For fine-grained module+action checks, use Cloud Functions as a middleware layer instead of encoding all logic in rules.

### Client-Side Query Pattern

Because rules are not filters, client queries MUST be scoped to the company:

```typescript
// CORRECT: query within company scope
const ref = collection(db, 'companies', companyId, 'transactions')
const q = query(ref, where('type', '==', 'income'))

// WRONG: trying to query across companies
// This will FAIL with permission denied
const ref = collectionGroup(db, 'transactions')
```

BusinessHub already does this correctly with `companyCollection(companyId, ...)`.

**Confidence:** HIGH -- based on official Firebase documentation and well-established patterns.

---

## 4. Client-Side Permission Enforcement

### Permission Context Provider

```typescript
// Simplified concept -- not production code
interface PermissionContext {
  role: string | null
  permissions: ModulePermission[]
  can: (module: string, action: string) => boolean
  isOwner: boolean
  isAdmin: boolean
  loading: boolean
}

function usePermissions(): PermissionContext {
  // 1. Read membership doc from Firestore on company change
  // 2. Cache in React state
  // 3. Provide `can()` helper for component-level checks
}
```

### UI Gating Pattern

```tsx
// Hide sidebar items user cannot access
function Sidebar() {
  const { can } = usePermissions()

  return (
    <nav>
      {can('finance', 'read') && <SidebarLink to="/finance" />}
      {can('payroll', 'read') && <SidebarLink to="/payroll" />}
      {can('talent', 'read')  && <SidebarLink to="/talent" />}
    </nav>
  )
}

// Disable write actions
function InvoiceActions({ invoice }) {
  const { can } = usePermissions()

  return (
    <>
      {can('finance', 'update') && <EditButton />}
      {can('finance', 'delete') && <DeleteButton />}
    </>
  )
}
```

### Critical Rule: Client-Side Checks Are UX Only

Client-side permission checks improve UX (hide buttons, disable routes) but **never replace server-side enforcement**. Firestore Security Rules and/or Cloud Functions must always be the real gatekeepers. A user could bypass React components using the browser console.

**Confidence:** HIGH -- standard pattern across all React permission libraries.

---

## 5. Multi-Company / Multi-Tenant Support

### Current Architecture

BusinessHub already supports multiple companies via the `companies/{companyId}` collection structure and the `CompanyProvider` context. Users can switch between companies in the UI.

### What Needs to Change

1. **Company membership** -- Currently, any authenticated user can access any company. Need to add membership documents.
2. **Per-company roles** -- A user might be "owner" of Company A but "viewer" of Company B.
3. **Company switching** -- When user switches company, re-fetch their membership/role for that company.
4. **Custom claims sync** -- When a user is added/removed from a company, a Cloud Function must update their custom claims.

### Custom Claims Sync Cloud Function

```typescript
// Trigger: when a membership document is created/deleted
export const onMembershipChange = onDocumentWritten(
  'companies/{companyId}/members/{userId}',
  async (event) => {
    const userId = event.params.userId

    // Query all companies this user belongs to
    // (use collectionGroup query from Admin SDK)
    const memberships = await admin.firestore()
      .collectionGroup('members')
      .where(admin.firestore.FieldPath.documentId(), '==', userId)
      .get()

    const companyIds = memberships.docs.map(
      doc => doc.ref.parent.parent!.id
    )

    // Update custom claims (just company IDs, under 1000 bytes)
    await admin.auth().setCustomUserClaims(userId, {
      companies: companyIds
    })
  }
)
```

### Token Refresh Consideration

Custom claims only update when the ID token refreshes (every ~1 hour). After changing claims:
- Force token refresh on the client: `await user.getIdToken(true)`
- Or accept eventual consistency (user sees changes on next token refresh)

For invitation acceptance, force an immediate token refresh so the user can access their new company right away.

**Confidence:** HIGH -- well-documented Firebase pattern.

---

## 6. Invitation Flow

### Recommended Flow

```
1. Admin enters email + selects role
2. Cloud Function creates invitation document
3. Cloud Function sends invitation email (via Firebase Extensions or custom)
4. Invitee clicks link, arrives at BusinessHub
   a. If already has account -> accept invitation, add membership
   b. If new user -> sign up flow, then accept invitation
5. Cloud Function creates membership doc + updates custom claims
6. Invitee can now access the company
```

### Invitation Document Structure

```
/companies/{companyId}/invitations/{inviteId}
{
  email: "invited@example.com",
  role: "finance",
  invitedBy: "ownerUserId",
  invitedByName: "Sebastian",
  status: "pending",          // "pending" | "accepted" | "expired" | "revoked"
  createdAt: Timestamp,
  expiresAt: Timestamp,       // 7 days from creation
  token: "randomSecureToken"  // for email link validation
}
```

### Cloud Function: Accept Invitation

```typescript
export const acceptInvitation = onCall(async (request) => {
  const { invitationId, companyId } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new HttpsError('unauthenticated', 'Must be signed in')

  const inviteRef = db.doc(`companies/${companyId}/invitations/${invitationId}`)
  const invite = await inviteRef.get()

  if (!invite.exists) throw new HttpsError('not-found', 'Invitation not found')

  const data = invite.data()!
  if (data.status !== 'pending') throw new HttpsError('failed-precondition', 'Already used')
  if (data.expiresAt.toDate() < new Date()) throw new HttpsError('failed-precondition', 'Expired')

  // Verify email matches
  const user = await admin.auth().getUser(userId)
  if (user.email !== data.email) throw new HttpsError('permission-denied', 'Email mismatch')

  // Create membership
  await db.doc(`companies/${companyId}/members/${userId}`).set({
    role: data.role,
    invitedBy: data.invitedBy,
    joinedAt: admin.firestore.Timestamp.now(),
    status: 'active',
  })

  // Mark invitation as accepted
  await inviteRef.update({ status: 'accepted' })

  // Custom claims will be updated by the onMembershipChange trigger

  return { success: true }
})
```

**Confidence:** MEDIUM-HIGH -- standard SaaS invitation pattern, Firebase-specific implementation details verified.

---

## 7. What Competitors Do (Reference Models)

### QuickBooks Online
- **Roles:** Primary Admin, Company Admin, Standard User, Time Tracking Only, Reports Only, Accountant
- **Granularity:** Module-level (Banking, Sales, Payroll, Expenses, Reports, Inventory)
- **Custom roles:** Available on Advanced plan -- select specific features per role
- **Key insight:** Separates "admin types" from "functional roles." Custom roles pick individual feature access.

### Xero
- **Roles:** Admin, Standard, Invoice Only, Read Only, Advisor (for external accountants)
- **Granularity:** Per-module toggle (Sales, Purchases, Bank, Payroll, Reports, Settings)
- **Key insight:** "Advisor" role for external access is a common pattern -- external accountants/auditors get read-only access.

### Gusto
- **Roles:** Primary Admin, Full Admin, Limited Admin (custom), People Manager, Basic (employee)
- **Granularity:** Limited Admins get custom feature access. Managers auto-assigned based on org chart.
- **Key insight:** "Manager" role is auto-assigned based on reporting structure. Managers see only their direct reports' data.

### BambooHR
- **Roles:** Full Admin, Payroll Admin, Custom Access Level, Employee
- **Granularity:** Module-level + field-level (can control which employee fields each access level can see/edit)
- **Key insight:** Field-level permissions for sensitive data (salary, SSN, etc.). Custom access levels are composable.

### Patterns Common Across All

1. **One "super admin" who cannot be removed** (Primary Admin / Account Owner)
2. **Module-level permissions** as the primary granularity
3. **Read vs. write separation** within modules
4. **"Viewer" or "Read Only" role** for external parties (accountants, auditors)
5. **Manager role** that scopes to their team only
6. **Custom roles** available as a premium feature
7. **Self-service for employees** (view own payroll, contracts, etc.)

**Confidence:** HIGH for patterns, MEDIUM for exact feature lists (based on public documentation, not hands-on testing).

---

## 8. Implementation Strategy for BusinessHub

### Phase 1: Foundation (Must Have)

1. Create `companies/{companyId}/members/{userId}` collection
2. Migrate existing users: create membership docs as `owner` for all current companies
3. Write Firestore Security Rules (company-scoped read/write for members only)
4. Create Cloud Function to sync custom claims on membership changes
5. Build `usePermissions()` hook
6. Gate sidebar navigation based on module permissions

### Phase 2: User Management

1. Build invitation flow (UI + Cloud Functions)
2. Settings page: "Team Members" list with role assignment
3. Role selector component with predefined roles
4. Email notifications for invitations

### Phase 3: Fine-Grained Enforcement

1. CRUD-level permission checks in UI (hide edit/delete buttons)
2. Cloud Functions middleware for write operations that checks module+action
3. Self-service employee portal (view own data only)
4. Manager scoping (see only direct reports)

### Phase 4: Advanced (Future)

1. Custom roles (compose module permissions per role)
2. Field-level visibility (hide salary fields from non-HR roles)
3. Audit log (who did what, when)
4. "Advisor" role for external accountants

---

## 9. Critical Pitfalls

### Pitfall 1: Storing Roles Only in Custom Claims (CRITICAL)
**What goes wrong:** Custom claims hit 1000-byte limit with 3+ companies. Claims are stale for up to 1 hour. No way to query "who has access to company X" from claims alone.
**Prevention:** Store roles in Firestore member docs. Use custom claims only for the company ID list.

### Pitfall 2: No Server-Side Enforcement (CRITICAL)
**What goes wrong:** Relying only on client-side `can()` checks. Users bypass React and access Firestore directly via console.
**Prevention:** Firestore Security Rules + Cloud Functions are the real gatekeepers. Client-side checks are UX sugar only.

### Pitfall 3: Forgetting Token Refresh After Claims Change (HIGH)
**What goes wrong:** User is invited to a company, but sees "access denied" because their token still has the old claims.
**Prevention:** Force `user.getIdToken(true)` after invitation acceptance. Show a "refreshing access..." state.

### Pitfall 4: Overly Complex Security Rules (HIGH)
**What goes wrong:** Trying to encode module+action+role checks entirely in Firestore rules. Rules become unmaintainable and hit the 10-read limit.
**Prevention:** Use rules for company membership checks only. Use Cloud Functions callable for write operations that need fine-grained permission checks.

### Pitfall 5: Settings Collection Not Scoped to Company (MODERATE)
**What goes wrong:** Current architecture stores categories, roles, and departments in global `/settings/` docs. When multiple companies exist with different users, all users share the same settings.
**Prevention:** Move company-specific settings (categories, departments, etc.) under `/companies/{companyId}/settings/` subcollection. Keep only truly global settings (role definitions) at the top level.

### Pitfall 6: No "Last Owner" Protection (MODERATE)
**What goes wrong:** Owner removes themselves, leaving a company with no owner.
**Prevention:** Prevent owner role removal if they are the last owner. Require transferring ownership first.

### Pitfall 7: Collection Group Queries Without Proper Indexes (LOW)
**What goes wrong:** Querying across all memberships (e.g., "which companies does this user belong to?") fails without collection group indexes.
**Prevention:** Create collection group indexes for the `members` subcollection.

---

## 10. Key Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Access model | RBAC with module permissions | Matches domain complexity, all competitors use it |
| Role storage | Firestore member docs | Custom claims too small for multi-company |
| Custom claims usage | Company ID list only | Fast membership check in security rules |
| Permission granularity | Module + CRUD actions | Field-level is over-engineering for now |
| Security rules scope | Company membership only | Module-level checks in Cloud Functions |
| Client-side enforcement | UX gating only | Never trust the client |
| Invitation flow | Firestore docs + Cloud Functions | Standard pattern, no third-party needed |
| Global settings migration | Move to company subcollection | Required for proper multi-tenant isolation |

---

## Sources

### Official Firebase Documentation
- [Custom Claims and Security Rules](https://firebase.google.com/docs/auth/admin/custom-claims) -- HIGH confidence
- [Role-Based Access in Firestore](https://firebase.google.com/docs/firestore/solutions/role-based-access) -- HIGH confidence
- [Firestore Security Rules Structure](https://firebase.google.com/docs/firestore/security/rules-structure) -- HIGH confidence
- [Security Rules Conditions](https://firebase.google.com/docs/firestore/security/rules-conditions) -- HIGH confidence

### Firebase Developer Community (Doug Stevenson, official Firebase team)
- [Group-Based Permissions for Firestore](https://medium.com/firebase-developers/patterns-for-security-with-firebase-group-based-permissions-for-cloud-firestore-72859cdec8f6) -- HIGH confidence
- [Supercharged Custom Claims with Firestore and Cloud Functions](https://medium.com/firebase-developers/patterns-for-security-with-firebase-supercharged-custom-claims-with-firestore-and-cloud-functions-bb8f46b24e11) -- HIGH confidence

### Access Control Models
- [RBAC vs ABAC vs PBAC (Oso)](https://www.osohq.com/learn/rbac-vs-abac-vs-pbac) -- MEDIUM confidence
- [RBAC vs ABAC (Oso)](https://www.osohq.com/learn/rbac-vs-abac) -- MEDIUM confidence

### Competitor Permission Models
- [QuickBooks User Roles](https://quickbooks.intuit.com/learn-support/en-us/help-article/access-permissions/user-roles-access-rights-quickbooks-online/L66POfRrI_US_en_US) -- HIGH confidence
- [Xero User Permissions](https://www.vintti.com/blog/how-to-set-up-users-in-xero-managing-access-and-permissions) -- MEDIUM confidence
- [Gusto Roles and Permissions](https://support.gusto.com/article/114138050100000/Manage-roles-and-permissions-in-Gusto-for-Primary-admins) -- HIGH confidence
- [BambooHR Access Levels](https://www.bamboohr.com/blog/access-levels-bamboohr) -- HIGH confidence

### Implementation Guides
- [Firebase RBAC with Custom Claims (FreeCodeCamp)](https://www.freecodecamp.org/news/firebase-rbac-custom-claims-rules/) -- MEDIUM confidence
- [Multi-Tenant SaaS on Firebase](https://medium.com/@beenakumawat002/building-a-multi-tenant-saas-on-firebase-in-2025-%EF%B8%8F-%EF%B8%8F-7a4acb019c3b) -- MEDIUM confidence
- [Firebase Auth Custom Claims Setup (OneUpTime)](https://oneuptime.com/blog/post/2026-02-17-how-to-set-up-firebase-auth-with-custom-claims-for-role-based-access-control-in-gcp/view) -- MEDIUM confidence
