# Analytics, Financial Architecture & Restaurant KPIs Knowledge Base

Research compiled: 2026-03-24

---

## Table of Contents

1. [Firestore/NoSQL Data Analysis Patterns](#1-firestorenosql-data-analysis-patterns)
2. [Restaurant Financial Management & KPIs](#2-restaurant-financial-management--kpis)
3. [Financial Data Integration in Web Applications](#3-financial-data-integration-in-web-applications)
4. [Real-time Analytics Architecture for Web Apps](#4-real-time-analytics-architecture-for-web-apps)
5. [Colombian Restaurant Financial Specifics](#5-colombian-restaurant-financial-specifics)

---

## 1. Firestore/NoSQL Data Analysis Patterns

### 1.1 Aggregation Strategies

Firestore offers three main approaches for aggregation:

#### A. Server-Side Aggregation Queries (Read-Time)
Firestore natively supports `count()`, `sum()`, and `average()` aggregation functions that execute on the server without downloading documents.

- **Pros**: Simple to implement, always up-to-date, no storage overhead
- **Cons**: No real-time listener support, cost scales with index entries scanned, limited to simple aggregations
- **Best for**: On-demand reports, admin dashboards with refresh buttons

```typescript
// Example: count transactions in a date range
const snapshot = await db.collection('transactions')
  .where('companyId', '==', companyId)
  .where('date', '>=', startDate)
  .where('date', '<=', endDate)
  .count()
  .get();
const totalCount = snapshot.data().count;
```

#### B. Write-Time Aggregation (Pre-Computed)
Update aggregation documents atomically whenever source data changes. This is the **recommended pattern for financial data**.

**Client-Side Transaction Pattern:**
```typescript
async function addTransaction(companyId: string, transaction: Transaction) {
  const txnRef = db.collection(`companies/${companyId}/transactions`).doc();
  const summaryRef = db.doc(`companies/${companyId}/summaries/monthly-${yearMonth}`);

  await db.runTransaction(async (t) => {
    const summaryDoc = await t.get(summaryRef);
    const current = summaryDoc.exists ? summaryDoc.data() : { income: 0, expenses: 0, count: 0 };

    const delta = transaction.type === 'income' ? transaction.amount : 0;
    const expDelta = transaction.type === 'expense' ? transaction.amount : 0;

    t.set(txnRef, transaction);
    t.set(summaryRef, {
      income: current.income + delta,
      expenses: current.expenses + expDelta,
      count: current.count + 1,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
}
```

**Cloud Functions Trigger Pattern:**
```typescript
exports.aggregateTransaction = functions.firestore
  .document('companies/{companyId}/transactions/{txnId}')
  .onWrite(async (change, context) => {
    const { companyId } = context.params;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    const summaryRef = db.doc(`companies/${companyId}/summaries/current`);

    await db.runTransaction(async (t) => {
      const summary = await t.get(summaryRef);
      let { totalIncome, totalExpenses, txnCount } = summary.data() || { totalIncome: 0, totalExpenses: 0, txnCount: 0 };

      // Reverse old values if updating/deleting
      if (before) {
        if (before.type === 'income') totalIncome -= before.amount;
        else totalExpenses -= before.amount;
        txnCount--;
      }
      // Apply new values if creating/updating
      if (after) {
        if (after.type === 'income') totalIncome += after.amount;
        else totalExpenses += after.amount;
        txnCount++;
      }

      t.set(summaryRef, { totalIncome, totalExpenses, txnCount, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
  });
```

**Trade-offs:**
| Aspect | Client-Side Transaction | Cloud Functions Trigger |
|--------|------------------------|------------------------|
| Latency | Immediate | 1-3 seconds delay |
| Offline support | No (requires server) | N/A (server-side) |
| Security | Needs rule adjustments | Server-side, more secure |
| Cost | 1 invocation | Function invocation cost |
| Complexity | Lower | Higher (deployment, monitoring) |

#### C. Distributed Counters (High-Velocity Writes)
For counters that update more than 1 time/second per document:

- Shard writes across N subcollection documents (`_counter_shards_/`)
- Each client increments its own shard
- Background workers aggregate shards into main document
- Firebase Extension `firestore-counter` automates this

**When to use**: View counts, like counts, visitor counters -- generally NOT needed for financial data (which has lower write velocity).

### 1.2 Denormalization Patterns for Reporting

#### Pattern: Summary Documents
Store pre-computed aggregates at each reporting level:

```
companies/{companyId}/
  summaries/
    daily-2026-03-24      { income, expenses, txnCount, byCategory: {...} }
    monthly-2026-03       { income, expenses, txnCount, byCategory: {...} }
    yearly-2026           { income, expenses, txnCount, byCategory: {...} }
  transactions/
    {txnId}               { individual transaction data }
```

#### Pattern: Denormalized Fields on Parent Documents
Copy frequently-queried aggregate fields onto parent documents:

```typescript
// On the company document itself
{
  name: "Mi Restaurante",
  currentMonthRevenue: 15000000,  // denormalized
  currentMonthExpenses: 9500000,  // denormalized
  activeEmployeeCount: 12,        // denormalized
  lastClosingDate: "2026-03-23"   // denormalized
}
```

**Best Practices:**
- Denormalize selectively -- only for frequently accessed data
- Use transactions or batch writes to ensure atomicity when updating denormalized data
- Accept eventual consistency for non-critical display data
- Keep source of truth in the original documents

### 1.3 Time-Series Data Storage

#### Bucketing Pattern
Group time-series data into "bucket" documents to reduce document count and optimize queries:

```
companies/{companyId}/
  dailySales/
    2026-03-24  {
      date: "2026-03-24",
      totalSales: 2500000,
      totalTransactions: 145,
      byHour: {
        "08": { sales: 180000, count: 12 },
        "09": { sales: 350000, count: 28 },
        ...
      },
      byPaymentMethod: {
        cash: 1200000,
        card: 1100000,
        transfer: 200000
      },
      byCategory: {
        food: 2000000,
        beverages: 400000,
        other: 100000
      }
    }
```

**Bucketing granularity guidelines:**
| Data Frequency | Bucket Size | Use Case |
|---------------|-------------|----------|
| Per-second | Hourly buckets | IoT, real-time sensors |
| Per-minute | Daily buckets | POS transactions |
| Per-hour | Weekly buckets | Aggregated reports |
| Per-day | Monthly buckets | Financial summaries |

**Benefits:**
- Fewer documents = fewer reads = lower cost
- Pre-aggregated data within buckets enables fast queries
- Date-range queries are efficient (query by document ID)
- Easy archival (move old buckets to cold storage)

### 1.4 Batch Operations for Financial Data Integrity

#### Firestore Transactions
```typescript
// Atomic transfer between accounts
async function transferFunds(fromAccountId: string, toAccountId: string, amount: number) {
  const fromRef = db.doc(`accounts/${fromAccountId}`);
  const toRef = db.doc(`accounts/${toAccountId}`);

  await db.runTransaction(async (t) => {
    const fromDoc = await t.get(fromRef);
    const toDoc = await t.get(toRef);

    const fromBalance = fromDoc.data().balance;
    if (fromBalance < amount) throw new Error('Insufficient funds');

    t.update(fromRef, { balance: fromBalance - amount });
    t.update(toRef, { balance: toDoc.data().balance + amount });

    // Also create journal entries
    t.set(db.collection('journal').doc(), {
      type: 'transfer',
      from: fromAccountId,
      to: toAccountId,
      amount,
      timestamp: FieldValue.serverTimestamp()
    });
  });
}
```

#### Batched Writes (No reads needed)
```typescript
// Batch import of transactions
const batch = db.batch();
transactions.forEach((txn, i) => {
  if (i > 0 && i % 500 === 0) {
    // Firestore limit: 500 operations per batch
    await batch.commit();
    batch = db.batch();
  }
  const ref = db.collection(`companies/${companyId}/transactions`).doc();
  batch.set(ref, txn);
});
await batch.commit();
```

**Key constraints:**
- Max 500 documents per batch/transaction
- Transaction retries up to 5 times on contention
- Max 1 write/second per document (sustained)
- Transactions lock documents during execution (serializable isolation)

---

## 2. Restaurant Financial Management & KPIs

### 2.1 Core Financial KPIs

#### Food Cost Percentage
```
Food Cost % = (Total Food Costs / Total Food Sales) x 100
```
- **Target range**: 28-35%
- **Quick-service**: 25-30%
- **Full-service**: 30-35%
- **Fine dining**: 33-38%
- Track weekly; investigate deviations > 2 percentage points

#### Labor Cost Percentage
```
Labor Cost % = (Total Labor Costs / Total Revenue) x 100
```
Where Total Labor Costs = wages + salaries + payroll taxes + benefits + workers' comp + insurance
- **Target range**: 20-30%
- **Quick-service**: 20-25%
- **Full-service**: 25-30%
- **Fine dining**: 30-35%

#### Prime Cost (THE Critical Metric)
```
Prime Cost = Food Cost + Beverage Cost + Total Labor Cost
Prime Cost % = Prime Cost / Total Revenue x 100
```
- **Target**: 55-65% of total revenue
- **Ideal**: < 60%
- **Warning**: > 65% threatens profitability
- **Critical**: > 70% makes profitability very difficult
- This is the single most important metric for restaurant viability

#### Gross Profit Margin
```
Gross Profit Margin = (Total Revenue - CoGS) / Total Revenue x 100
```
- **Target range**: 65-75%

#### Net Profit Margin
```
Net Profit Margin = Net Income / Total Revenue x 100
```
- **Full-service average**: ~10.5%
- **Quick-service average**: ~6-9%

#### Overhead Rate
```
Overhead Rate = Total Overhead Costs / Total Revenue x 100
```
Overhead = rent + utilities + insurance + marketing + depreciation + admin
- **Target**: < 30% of total revenue

### 2.2 Operational KPIs

#### RevPASH (Revenue Per Available Seat Hour)
```
RevPASH = Total Revenue in Period / (Number of Seats x Hours Open in Period)
```
- **Quick-service target**: $10-15/seat/hour
- **Full-service target**: $15-25/seat/hour
- **Fine dining target**: $30-50+/seat/hour during prime slots
- Helps decide between table turnover vs. upselling strategies

#### Table Turnover Rate
```
Table Turnover = Number of Parties Served / Number of Tables
```
- **Family restaurant average**: 3 turns/day
- **Quick-service**: 5-8 turns/day
- **Fine dining**: 1.5-2 turns/day

#### Average Check (Average Spend Per Cover)
```
Average Check = Total Revenue / Total Covers (guests served)
```
- Track daily against targets
- Common targets: $22 midweek, $32 weekends (varies enormously by concept)

#### Sales Per Square Foot
```
Sales/sq ft = Total In-House Sales / Total Interior Square Footage
```
- **Full-service target**: $250-325/sq ft annually
- **Limited-service target**: $300-400/sq ft annually

#### Inventory Turnover Rate
```
Inventory Turnover = CoGS for Period / Average Inventory Value for Period
```
- Higher = better (efficient stock management)
- **Restaurant target**: 4-8x per month for perishables

#### Staff Turnover Rate
```
Staff Turnover = (Employees Who Left / Total Positions) x 100
```
- **Full-service average**: 27% annually
- Lower is better; high turnover costs 30-50% of annual salary per replacement

### 2.3 Break-Even Analysis

#### Basic Formula
```
Break-Even Point (units) = Total Fixed Costs / Contribution Margin per Unit
Break-Even Point ($) = Total Fixed Costs / Contribution Margin Ratio
```

#### Contribution Margin
```
Contribution Margin = Revenue per Unit - Variable Cost per Unit
Contribution Margin Ratio = Contribution Margin / Revenue per Unit
```

#### Practical Example
- Monthly fixed costs: $50,000,000 COP
- Average check: $45,000 COP
- Variable cost per cover: $18,000 COP
- Contribution margin: $27,000 COP
- Contribution margin ratio: 0.60 (60%)
- Break-even in covers: 50,000,000 / 27,000 = 1,852 covers/month
- Break-even in sales: 50,000,000 / 0.60 = $83,333,333 COP/month
- Break-even per day (30 days): 62 covers/day or $2,777,778 COP/day

#### Cost Classification for Restaurants
| Category | Type | Examples |
|----------|------|----------|
| Fixed | Constant regardless of sales | Rent, insurance, licenses, loan payments, base salaries |
| Variable | Changes with sales volume | Food costs, hourly labor, packaging, credit card fees |
| Mixed | Part fixed, part variable | Utilities (base + usage), management labor |

### 2.4 Menu Engineering Matrix

The menu engineering matrix classifies items on two axes:
- **X-axis**: Popularity (Menu Mix %) -- percentage of total units sold
- **Y-axis**: Profitability (Contribution Margin) -- selling price minus food cost

#### Classification Criteria
```
Menu Mix % Threshold = 100% / Number of Menu Items x 70%
  (An item is "popular" if its mix % exceeds this threshold)

Contribution Margin Threshold = Weighted Average CM of all items
  (An item is "profitable" if its CM exceeds this average)
```

#### The Four Categories

| Category | Popularity | Profitability | Strategy |
|----------|-----------|---------------|----------|
| **Stars** | High | High | Promote heavily, maintain quality, feature prominently |
| **Plowhorses** | High | Low | Reduce portion, increase price slightly, re-engineer recipe |
| **Puzzles** | Low | High | Reposition on menu, train servers to upsell, rename/rebrand |
| **Dogs** | Low | Low | Remove from menu, replace, or reinvent completely |

#### Menu Engineering Formulas
```
Food Cost % per item = Item Food Cost / Item Selling Price x 100
Contribution Margin = Selling Price - Food Cost
Menu Mix % = Items Sold / Total Items Sold x 100
Weighted CM = Sum(CM per item x Quantity Sold) / Total Quantity Sold
```

### 2.5 Cash Flow Management

#### 13-Week Rolling Cash Flow Model
Structure for weekly cash flow projection:

```
Week N:
  Opening Cash Balance
  + Cash Inflows:
    - Daily sales (by payment method)
    - Catering deposits
    - Other income
  - Cash Outflows:
    - Food/beverage purchases
    - Payroll
    - Rent
    - Utilities
    - Insurance
    - Loan payments
    - Tax payments
    - Other operating expenses
  = Closing Cash Balance
```

**Best practices:**
- Track weekly, not just monthly
- Use POS data to forecast sales by day of week
- Map cash inflows to payment method timing (cash = immediate, cards = 1-3 day settlement)
- Negotiate vendor payment terms (Net 15 to Net 30)
- Build 2-4 weeks of operating expenses as cash reserve
- Update forecast weekly with actuals

---

## 3. Financial Data Integration in Web Applications

### 3.1 POS-to-Accounting Integration Patterns

#### Data Flow Architecture
```
POS System
  |
  v
Daily Sales Summary (automated)
  |
  v
Journal Entry Generator
  |
  v
General Ledger
  |
  v
Financial Reports (P&L, Balance Sheet, Cash Flow)
```

#### Automated Transaction Generation
When a POS closing occurs, generate journal entries automatically:

```typescript
// Example: Generate journal entries from daily POS closing
function generateDailyJournalEntries(closing: DailyClosing): JournalEntry[] {
  const entries: JournalEntry[] = [];
  const date = closing.date;

  // 1. Record cash sales
  if (closing.cashSales > 0) {
    entries.push({
      date, account: 'cash',         debit: closing.cashSales, credit: 0,
      description: `Ventas en efectivo ${date}`
    });
    entries.push({
      date, account: 'sales-revenue', debit: 0, credit: closing.cashSales,
      description: `Ventas en efectivo ${date}`
    });
  }

  // 2. Record card sales (receivable until settlement)
  if (closing.cardSales > 0) {
    entries.push({
      date, account: 'accounts-receivable-cards', debit: closing.cardSales, credit: 0,
      description: `Ventas con tarjeta ${date}`
    });
    entries.push({
      date, account: 'sales-revenue', debit: 0, credit: closing.cardSales,
      description: `Ventas con tarjeta ${date}`
    });
  }

  // 3. Record consumption tax (impoconsumo 8%)
  const taxableBase = closing.totalSales;
  const impoconsumo = taxableBase * 0.08;
  entries.push({
    date, account: 'impoconsumo-payable', debit: 0, credit: impoconsumo,
    description: `Impoconsumo 8% del ${date}`
  });

  // 4. Record CoGS
  entries.push({
    date, account: 'cost-of-goods-sold', debit: closing.totalFoodCost, credit: 0,
    description: `Costo de mercancia vendida ${date}`
  });
  entries.push({
    date, account: 'inventory',           debit: 0, credit: closing.totalFoodCost,
    description: `Salida de inventario ${date}`
  });

  return entries;
}
```

### 3.2 Double-Entry Bookkeeping for Web Apps

#### Data Model (3-Table Pattern)
```typescript
// Table 1: Accounts (Chart of Accounts)
interface Account {
  id: string;
  code: string;          // e.g., "1105" (PUC code in Colombia)
  name: string;          // e.g., "Caja General"
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  isBalanceSheet: boolean; // true for asset/liability/equity
  parentId?: string;     // for hierarchical chart of accounts
  normalBalance: 'debit' | 'credit';
}

// Table 2: Transactions (groups related journal entries)
interface Transaction {
  id: string;
  date: Timestamp;
  description: string;
  reference?: string;    // invoice number, receipt, etc.
  source: 'manual' | 'pos-closing' | 'payroll' | 'import';
  companyId: string;
  createdAt: Timestamp;
}

// Table 3: Journal Entries (individual debit/credit lines)
interface JournalEntry {
  id: string;
  transactionId: string;
  accountId: string;
  amount: number;        // positive = debit, negative = credit (or use separate fields)
  debit: number;
  credit: number;
  date: Timestamp;
  companyId: string;
}
```

#### Validation Rule
Every transaction MUST satisfy:
```
Sum of all debits = Sum of all credits (for each transaction)
```

#### Balance Calculation
```typescript
// Account balance at a point in time
function getBalance(accountId: string, asOfDate: Date): number {
  const entries = journalEntries
    .filter(e => e.accountId === accountId && e.date <= asOfDate);
  return entries.reduce((sum, e) => sum + e.debit - e.credit, 0);
}

// For liability/equity/income accounts, negate the result for display
// (their natural balance is credit-positive)
```

#### Financial Statement Generation
```typescript
// Income Statement (P&L) for a period
function incomeStatement(startDate: Date, endDate: Date) {
  const incomeAccounts = accounts.filter(a => a.type === 'income');
  const expenseAccounts = accounts.filter(a => a.type === 'expense');

  const totalIncome = incomeAccounts.reduce((sum, acc) =>
    sum + getPeriodTotal(acc.id, startDate, endDate), 0);

  const totalExpenses = expenseAccounts.reduce((sum, acc) =>
    sum + getPeriodTotal(acc.id, startDate, endDate), 0);

  return {
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses
  };
}
```

### 3.3 Financial Reconciliation Patterns

#### POS Reconciliation Formula
```
Expected Cash = Starting Cash + Cash Sales + Pay-Ins - Pay-Outs - Cash Refunds
Variance = Actual Cash Counted - Expected Cash
```

#### Reconciliation Algorithm
```typescript
interface ReconciliationResult {
  date: string;
  expectedCash: number;
  actualCash: number;
  variance: number;
  variancePercent: number;
  status: 'balanced' | 'short' | 'over';
  discrepancies: Discrepancy[];
}

function reconcileDay(closing: DailyClosing): ReconciliationResult {
  const expectedCash = closing.openingCash
    + closing.cashSales
    + closing.cashPayIns
    - closing.cashPayOuts
    - closing.cashRefunds;

  const variance = closing.actualCashCount - expectedCash;
  const variancePercent = (variance / expectedCash) * 100;

  return {
    date: closing.date,
    expectedCash,
    actualCash: closing.actualCashCount,
    variance,
    variancePercent,
    status: Math.abs(variance) < 1000 ? 'balanced' : variance < 0 ? 'short' : 'over',
    discrepancies: variance !== 0 ? [{ amount: variance, notes: '' }] : []
  };
}
```

#### Multi-Source Reconciliation
```
Bank Statement Balance
  + Deposits in Transit (recorded in books, not yet in bank)
  - Outstanding Checks (issued but not yet cleared)
  = Adjusted Bank Balance

Book Balance
  + Bank Credits (interest, etc. not yet recorded)
  - Bank Charges (fees, etc. not yet recorded)
  = Adjusted Book Balance

Adjusted Bank Balance SHOULD EQUAL Adjusted Book Balance
```

---

## 4. Real-time Analytics Architecture for Web Apps

### 4.1 CQRS for Financial Applications

#### Architecture Overview
```
Commands (Writes)                  Queries (Reads)
     |                                  |
     v                                  v
Write Model                        Read Model
(Firestore transactions)     (Pre-computed summaries)
     |                                  ^
     v                                  |
Cloud Function Trigger -----> Update Read Model
     |
     v
Event Log (audit trail)
```

**Key principles for financial CQRS:**
- Commands represent business operations: "Record Sale", "Close Register", "Pay Supplier"
- Commands validate business rules before executing
- Read model stores materialized views optimized for dashboard queries
- Event log maintains full audit trail for compliance
- Read model can be rebuilt from event history

#### Firestore CQRS Implementation
```
companies/{companyId}/
  # WRITE MODEL (source of truth)
  transactions/{txnId}         # individual financial events
  closings/{closingId}         # daily closing records
  purchases/{purchaseId}       # purchase orders

  # READ MODEL (pre-computed for dashboards)
  summaries/
    today                      # real-time today's figures
    current-month              # month-to-date aggregates
    current-year               # year-to-date aggregates
    daily-{YYYY-MM-DD}         # historical daily summaries
    monthly-{YYYY-MM}          # historical monthly summaries

  # EVENT LOG (audit trail)
  auditLog/{eventId}           # immutable event records
```

### 4.2 Pre-Computed vs. On-Demand Aggregation

| Factor | Pre-Computed | On-Demand |
|--------|-------------|-----------|
| Read speed | O(1) - instant | O(n) - scales with data |
| Write cost | Higher (must update aggregates) | None |
| Storage cost | Higher (stores aggregates) | Lower |
| Data freshness | Real-time or near-real-time | Always current |
| Complexity | Higher (maintain consistency) | Lower |
| Firestore cost | Lower reads, higher writes | Higher reads |
| Best for | Dashboards, KPIs, frequent reads | Ad-hoc reports, rarely accessed |

**Recommendation for BuisinessHub**: Use **pre-computed aggregations** for:
- Dashboard KPIs (read frequently, update on each transaction)
- Monthly summaries (update incrementally)
- Year-to-date totals (update incrementally)

Use **on-demand aggregation** for:
- Custom date range reports
- Export/download operations
- Rarely-accessed historical analysis

### 4.3 Dashboard Data Flow Pattern

```
Transaction Created/Updated/Deleted
  |
  v
Cloud Function Trigger (or client-side transaction)
  |
  +--> Update daily summary document
  +--> Update monthly summary document
  +--> Update YTD summary document
  +--> Update category breakdowns
  +--> Write to audit log
  |
  v
Dashboard Component
  |
  +--> useFirestore('summaries/current-month') // real-time listener
  +--> Display KPI cards with pre-computed values
  +--> Show charts from pre-aggregated category data
```

### 4.4 Period-over-Period Comparison

#### Algorithm
```typescript
interface PeriodComparison {
  current: number;
  previous: number;
  absoluteChange: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'flat';
}

function comparePeriods(currentValue: number, previousValue: number): PeriodComparison {
  const absoluteChange = currentValue - previousValue;
  const percentageChange = previousValue !== 0
    ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
    : currentValue > 0 ? 100 : 0;

  return {
    current: currentValue,
    previous: previousValue,
    absoluteChange,
    percentageChange,
    trend: Math.abs(percentageChange) < 1 ? 'flat'
           : percentageChange > 0 ? 'up' : 'down'
  };
}
```

#### Standard Comparison Periods
```typescript
type ComparisonPeriod =
  | 'day-over-day'       // Today vs yesterday
  | 'week-over-week'     // This week vs last week
  | 'month-over-month'   // This month vs last month
  | 'year-over-year'     // This month vs same month last year
  | 'mtd-vs-prior'       // Month-to-date vs prior month same days
  | 'ytd-vs-prior'       // Year-to-date vs prior year same days
```

#### Data Structure for Period Summaries
```typescript
interface PeriodSummary {
  periodKey: string;       // "2026-03", "2026-W12", "2026-03-24"
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  averageTicket: number;
  byCategory: Record<string, number>;
  byPaymentMethod: Record<string, number>;
  foodCostPercent: number;
  laborCostPercent: number;
  primeCostPercent: number;
}
```

### 4.5 Event-Driven Architecture for Financial Data

#### Event Types for Restaurant Finance
```typescript
type FinancialEvent =
  | { type: 'SALE_RECORDED'; data: { amount, items, paymentMethod, timestamp } }
  | { type: 'EXPENSE_RECORDED'; data: { amount, category, supplier, timestamp } }
  | { type: 'REGISTER_OPENED'; data: { openingCash, operator, timestamp } }
  | { type: 'REGISTER_CLOSED'; data: { closingData, operator, timestamp } }
  | { type: 'INVENTORY_RECEIVED'; data: { items, supplier, cost, timestamp } }
  | { type: 'PAYROLL_PROCESSED'; data: { period, totalAmount, employees, timestamp } }
  | { type: 'TAX_PAYMENT'; data: { taxType, amount, period, timestamp } }
  | { type: 'RECONCILIATION_COMPLETED'; data: { date, variance, status, timestamp } }
```

#### Snapshot Pattern for Performance
```typescript
// Store periodic snapshots to avoid replaying all events
interface Snapshot {
  snapshotDate: Timestamp;
  accountBalances: Record<string, number>;
  inventoryLevels: Record<string, number>;
  ytdTotals: { revenue: number; expenses: number; netIncome: number };
}

// To get current state: load latest snapshot + replay events after snapshot date
```

---

## 5. Colombian Restaurant Financial Specifics

### 5.1 Cierre de Caja (Daily Cash Closing)

#### Standard Process for Colombian Restaurants

**Step 1: Verify Open Tickets**
- Close all open orders/tickets in POS
- Verify all tables are settled
- Process any pending deliveries

**Step 2: Generate Z Report (Informe Z / Zeta Diario)**
- POS system generates end-of-day summary
- Includes: total sales, payment method breakdown, tax collected, discounts, voids
- This report is the basis for daily accounting

**Step 3: Cash Count**
- Physical count of all cash in register(s)
- Document by denomination
- Calculate: Expected Cash = Opening Cash + Cash Sales + Pay-Ins - Pay-Outs

**Step 4: Payment Method Reconciliation**
```
Total Sales = Cash Sales + Card Sales + Digital Payments + Other
Card Sales should match POS card terminal batch total
Digital payments should match platform reports (Rappi, iFood, etc.)
```

**Step 5: Record Discrepancies**
- Document any variance between expected and actual cash
- Colombian regulation: persistent discrepancies may trigger DIAN scrutiny
- Acceptable variance threshold: typically < $5,000 COP

**Step 6: Tax Calculation**
```
Impoconsumo (8%) = Total Sales Before Tax x 8%
(For restaurants not under franchise model)
```

**Step 7: Store Cash and Submit Report**
- Secure cash in safe or prepare bank deposit
- Submit digital closing report through management system
- File supports DIAN electronic invoicing audit trail

### 5.2 DIAN Electronic Invoicing Integration

#### Requirements (as of 2025-2026)
- **ALL restaurants must issue electronic invoices** (factura electronica)
- DIAN actively closes non-compliant establishments (47 closures in Bogota alone, including famous La Puerta Falsa)
- Penalties: fines up to 1% of invalid invoice values, closure for up to 30 days
- DIAN's "Centro de Monitoreo de Factura Electronica" monitors compliance in real-time

#### POS-to-DIAN Integration Flow
```
POS Sale
  |
  v
Generate Electronic Invoice (XML UBL 2.1 format)
  |
  v
Sign with Digital Certificate
  |
  v
Send to DIAN Validation Service
  |
  v
Receive CUFE (Codigo Unico de Factura Electronica)
  |
  v
Deliver to Customer (email/print)
  |
  v
Store in System (mandatory 5-year retention)
```

#### Document Types
- **Factura Electronica de Venta**: Standard sales invoice
- **Nota Credito**: Credit note (for returns, corrections)
- **Nota Debito**: Debit note (for additional charges)
- **Documento Soporte**: For purchases from non-invoicing suppliers (e.g., small farmers)

### 5.3 Impoconsumo (Consumption Tax) Impact

#### Tax Rules for Restaurants
| Scenario | Tax | Rate |
|----------|-----|------|
| Regular restaurant (not franchise) | Impoconsumo (INC) | 8% |
| Franchise restaurant | IVA | 19% |
| Delivery/takeout | Impoconsumo | 8% |
| Alcoholic beverages in bars | Impoconsumo | 8% |
| Hospital/clinic meals | Excluded | 0% |

#### Non-Responsible Threshold (2025-2026)
Restaurants below these thresholds are NOT required to charge impoconsumo:
- Gross income from restaurant activities < 3,500 UVT ($174,297,000 COP for 2025)
- Only ONE establishment operated
- NOT operating under franchise model

#### Key Differences: Impoconsumo vs. IVA
| Aspect | Impoconsumo (INC) | IVA |
|--------|-------------------|-----|
| Rate for restaurants | 8% | 19% |
| Tax credits (deductible) | NO | YES |
| Filing frequency | Bi-monthly (Form 310) | Bi-monthly (Form 300) |
| Applies to | Non-franchise restaurants | Franchise restaurants |
| Accounting complexity | Simpler | More complex |
| Menu price display | Must include tax in displayed price | Must include tax in displayed price |

#### Financial Reporting Impact
```
Revenue Recognition:
  Gross Sale Price = Net Sale + Impoconsumo
  Net Revenue = Gross Sale Price - Impoconsumo

  Example:
  Customer pays: $50,000 COP (menu price, tax included)
  Net Sale: $50,000 / 1.08 = $46,296 COP
  Impoconsumo: $50,000 - $46,296 = $3,704 COP

  Journal Entry:
  DR  Cash/Bank           $50,000
    CR  Sales Revenue              $46,296
    CR  Impoconsumo Payable        $3,704
```

### 5.4 NIIF Accounting Standards

#### Applicable Framework
Most Colombian restaurants fall under **Grupo 2 - NIIF para Pymes** (Decreto 2420 de 2015, updated by Decreto 2483 de 2018):

**Grupo 2 criteria (apply NIIF Pymes simplified):**
- Not listed on stock exchange
- Not required to report publicly
- Annual assets between 500 and 30,000 SMMLV
- Between 11 and 200 employees
- Simplified 35-section standard

**Grupo 3 criteria (micro-enterprises, even simpler):**
- Assets < 500 SMMLV
- < 10 employees
- Simplified cash-basis accounting allowed

#### Key NIIF Sections for Restaurants
| Section | Topic | Relevance |
|---------|-------|-----------|
| Section 2 | Concepts and Principles | Revenue recognition, expense matching |
| Section 5 | Income Statement | P&L presentation format |
| Section 13 | Inventories | Food inventory valuation (lower of cost or NRV) |
| Section 17 | Property, Plant & Equipment | Kitchen equipment, furniture depreciation |
| Section 23 | Revenue | When to recognize restaurant sales |
| Section 28 | Employee Benefits | Payroll provisions, social benefits |

#### 2025 Update
The IASB issued the **third edition of NIIF for Pymes** in February 2025, with significant updates after 10 years. Colombian adoption expected via new decree.

### 5.5 Tax Calendar for Colombian Restaurants

#### Bi-Monthly Tax Filing Periods
| Period | Months | Filing Deadline (approximate) |
|--------|--------|-------------------------------|
| 1 | January - February | March |
| 2 | March - April | May |
| 3 | May - June | July |
| 4 | July - August | September |
| 5 | September - October | November |
| 6 | November - December | January (next year) |

#### Monthly/Annual Obligations
- **Retencion en la Fuente**: Monthly filing (Form 350)
- **ICA** (Industria y Comercio): Bi-monthly or annual depending on municipality
- **Renta**: Annual income tax filing
- **Informacion Exogena**: Annual detailed reporting to DIAN

---

## Summary: Recommended Architecture for BuisinessHub

### Data Model Strategy
1. **Write Model**: Individual transactions, closings, purchases in Firestore collections
2. **Read Model**: Pre-computed daily/monthly/yearly summaries updated via transactions or Cloud Functions
3. **Audit Trail**: Immutable event log for compliance and reconstruction

### Aggregation Strategy
- Use **client-side transactions** for immediate aggregation (simpler, no Cloud Functions dependency)
- Fall back to **Cloud Functions** only for complex multi-collection aggregations
- Use **bucketed daily summaries** as the primary reporting unit
- Build monthly/yearly summaries from daily summaries

### KPI Computation
- Pre-compute all core KPIs (food cost %, labor cost %, prime cost) in summary documents
- Include period-over-period deltas in summary documents
- Menu engineering matrix computed on-demand (less frequently accessed)

### Colombian Compliance
- Integrate impoconsumo (8%) calculation into every sale recording
- Generate DIAN-compatible electronic invoice data
- Structure daily closing to produce all required reconciliation data
- Follow NIIF Pymes Grupo 2 chart of accounts structure

---

## 6. Integracion Especifica para BuisinessHub

### 6.1 Extension del Modelo Transaction

El modelo `Transaction` actual (`src/modules/finance/types.ts`) necesita campos adicionales para soportar la integracion cross-module:

```typescript
// Campos actuales
interface Transaction extends BaseEntity {
  concept: string
  category: string
  amount: number
  type: TransactionType        // 'income' | 'expense'
  date: Timestamp
  status: TransactionStatus    // 'paid' | 'pending' | 'overdue'
  notes?: string
}

// Campos nuevos para integracion
interface Transaction extends BaseEntity {
  // ... campos existentes ...
  sourceType?: 'manual' | 'closing' | 'purchase'  // origen del registro
  sourceId?: string                                 // ID del documento origen
  autoGenerated?: boolean                           // true si fue creado automaticamente
  paymentMethod?: string                            // 'efectivo' | 'datafono' | 'qr' | 'rappi' | 'ap'
}
```

**Reglas de negocio:**
- `sourceType: 'manual'` o `undefined` → transacciones creadas manualmente por el usuario
- `sourceType: 'closing'` → generadas automaticamente desde un cierre de caja
- `sourceType: 'purchase'` → generadas automaticamente desde una compra
- Las transacciones con `autoGenerated: true` no deben ser editables directamente (editar el documento origen)

### 6.2 Mapeo Closing → Finance (Transacciones Automaticas)

Cuando se crea un `Closing` (`src/modules/closings/types.ts`), se generan las siguientes transacciones en Finance:

#### Opcion A: Transaccion consolidada (recomendada para simplicidad)

| Campo Closing | Transaccion Generada | Tipo | Categoria | Status |
|---------------|---------------------|------|-----------|--------|
| `ventaTotal` | Venta total del dia | `income` | Ventas | `paid` |
| `propinas` | Propinas del dia | `income` | Propinas | `paid` |
| `gastos` | Gastos operacionales del dia | `expense` | Gastos Operacionales | `paid` |

```typescript
// Ejemplo de generacion desde Closing
function generateTransactionsFromClosing(closing: Closing, closingId: string): TransactionFormData[] {
  const transactions: TransactionFormData[] = []
  const date = Timestamp.fromDate(new Date(closing.date))

  // 1. Venta total
  if (closing.ventaTotal > 0) {
    transactions.push({
      concept: `Ventas del ${closing.date} (${closing.responsable})`,
      category: 'Ventas',
      amount: closing.ventaTotal,
      type: 'income',
      date,
      status: 'paid',
      sourceType: 'closing',
      sourceId: closingId,
      autoGenerated: true,
      notes: `Efectivo: ${closing.efectivo} | Datafono: ${closing.datafono} | QR: ${closing.qr} | Rappi: ${closing.rappiVentas} | AP: ${closing.ap}`
    })
  }

  // 2. Propinas (si hay)
  if (closing.propinas > 0) {
    transactions.push({
      concept: `Propinas del ${closing.date}`,
      category: 'Propinas',
      amount: closing.propinas,
      type: 'income',
      date,
      status: 'paid',
      sourceType: 'closing',
      sourceId: closingId,
      autoGenerated: true
    })
  }

  // 3. Gastos operacionales (si hay)
  if (closing.gastos > 0) {
    transactions.push({
      concept: `Gastos operacionales del ${closing.date}`,
      category: 'Gastos Operacionales',
      amount: closing.gastos,
      type: 'expense',
      date,
      status: 'paid',
      sourceType: 'closing',
      sourceId: closingId,
      autoGenerated: true
    })
  }

  return transactions
}
```

#### Opcion B: Transacciones granulares por metodo de pago

| Campo Closing | Transaccion | Categoria |
|---------------|-------------|-----------|
| `efectivo` | Ventas en efectivo | Ventas > Efectivo |
| `datafono` | Ventas con tarjeta | Ventas > Datafono |
| `qr` | Ventas por QR | Ventas > QR |
| `rappiVentas` | Ventas por Rappi | Ventas > Rappi |
| `ap` | Ventas por APP | Ventas > APP |

#### Operaciones atomicas con writeBatch

```typescript
import { writeBatch } from 'firebase/firestore'

async function createClosingWithTransactions(companyId: string, closingData: ClosingFormData) {
  const batch = writeBatch(db)

  // 1. Crear el cierre
  const closingRef = doc(collection(db, `companies/${companyId}/closings`))
  batch.set(closingRef, { ...closingData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() })

  // 2. Generar y crear transacciones vinculadas
  const transactions = generateTransactionsFromClosing(closingData, closingRef.id)
  for (const txn of transactions) {
    const txnRef = doc(collection(db, `companies/${companyId}/transactions`))
    batch.set(txnRef, { ...txn, createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
  }

  // 3. Commit atomico
  await batch.commit()
  return closingRef.id
}
```

#### Sincronizacion en edicion y eliminacion

- **Editar Closing**: Buscar transacciones con `sourceType: 'closing'` + `sourceId: closingId`, actualizarlas o recrearlas
- **Eliminar Closing**: Eliminar todas las transacciones vinculadas en el mismo batch
- **Idempotencia**: Antes de generar, verificar que no existan transacciones con el mismo `sourceId`

### 6.3 Mapeo Purchase → Finance (Transacciones Automaticas)

Cuando se crea un `Purchase` (`src/modules/purchases/types.ts`), se genera una transaccion de gasto:

| Campo Purchase | Transaccion Generada | Detalles |
|----------------|---------------------|----------|
| `total` | Gasto por compra | `type: 'expense'` |
| `paymentStatus` | → `status` | `'paid'` → `'paid'`, `'pending'` → `'pending'`, `'overdue'` → `'overdue'` |
| `supplierName` | → `concept` | `"Compra a {supplierName}"` |
| `date` | → `date` | Misma fecha de la compra |

```typescript
function generateTransactionFromPurchase(purchase: Purchase, purchaseId: string): TransactionFormData {
  return {
    concept: `Compra a ${purchase.supplierName}${purchase.invoiceNumber ? ` (Fact. ${purchase.invoiceNumber})` : ''}`,
    category: 'Compras',
    amount: purchase.total,
    type: 'expense',
    date: purchase.date,
    status: purchase.paymentStatus,   // mapeo directo: ambos usan 'paid' | 'pending' | 'overdue'
    sourceType: 'purchase',
    sourceId: purchaseId,
    autoGenerated: true,
    notes: `Proveedor: ${purchase.supplierName} | Subtotal: ${purchase.subtotal} | IVA: ${purchase.tax} | Items: ${purchase.items.length}`
  }
}
```

#### Sincronizacion bidireccional de estado de pago

```typescript
// Cuando Purchase.paymentStatus cambia → actualizar Transaction.status
async function syncPurchasePaymentStatus(companyId: string, purchaseId: string, newStatus: PaymentStatus) {
  // 1. Buscar transaccion vinculada
  const txns = await getDocs(
    query(
      collection(db, `companies/${companyId}/transactions`),
      where('sourceType', '==', 'purchase'),
      where('sourceId', '==', purchaseId)
    )
  )

  // 2. Actualizar estado
  const batch = writeBatch(db)
  txns.forEach(doc => {
    batch.update(doc.ref, { status: newStatus, updatedAt: Timestamp.now() })
  })
  await batch.commit()
}
```

### 6.4 KPIs Cross-Module (Compras + Finanzas + Cierres)

Estas formulas cruzan datos de los tres modulos para generar metricas financieras integradas:

#### KPIs de Rentabilidad

| KPI | Formula | Fuentes de Datos | Target |
|-----|---------|-----------------|--------|
| **Food Cost %** | `Σ purchases.total / Σ closings.ventaTotal × 100` | Purchases + Closings | 28-35% |
| **Labor Cost %** | `Σ employees.salary / Σ closings.ventaTotal × 100` | Talent + Closings | 25-35% |
| **Prime Cost %** | `(Food Cost + Labor Cost) / Σ closings.ventaTotal × 100` | Purchases + Talent + Closings | 55-65% |
| **Gross Margin** | `(Σ ventaTotal - Σ purchases.total) / Σ ventaTotal × 100` | Closings + Purchases | 65-72% |
| **Net Margin** | `(Σ income - Σ expenses) / Σ income × 100` | Finance (transactions) | 5-15% |

#### KPIs de Ventas (desde Cierres)

| KPI | Formula | Fuente |
|-----|---------|--------|
| **Venta Promedio Diaria** | `Σ closings.ventaTotal / dias_con_cierre` | Closings |
| **% Metodo de Pago** | `closing.{metodo} / closing.ventaTotal × 100` | Closings |
| **% Delivery** | `Σ closings.rappiVentas / Σ closings.ventaTotal × 100` | Closings |
| **% Propinas** | `Σ closings.propinas / Σ closings.ventaTotal × 100` | Closings |
| **Varianza de Caja** | `entregaEfectivo - (efectivo - gastos - cajaMenor)` | Closings |

#### KPIs de Compras (desde Purchases)

| KPI | Formula | Fuente |
|-----|---------|--------|
| **Frecuencia de Compra** | `count(purchases) / meses` por proveedor | Purchases |
| **Variacion de Precios** | `(precio_actual - precio_anterior) / precio_anterior × 100` | Purchases (ya en `usePurchaseAlerts()`) |
| **Concentracion de Proveedor** | `spend_top_supplier / total_spend × 100` | Purchases |
| **Cumplimiento de Pago** | `count(paid_on_time) / count(total) × 100` | Purchases |

#### KPIs de Reconciliacion

| KPI | Formula | Fuente |
|-----|---------|--------|
| **Cobertura de Cierres** | `dias_con_cierre / dias_del_mes × 100` | Closings |
| **Consistencia Financiera** | `Σ txn_auto_income - Σ closings.ventaTotal` (debe ser 0) | Finance + Closings |
| **Compras sin Vincular** | `count(purchases sin sourceId en transactions)` | Purchases + Finance |

### 6.5 Indices Firestore Necesarios

Para soportar las consultas cross-module, se necesitan los siguientes indices compuestos:

```
// En transactions collection
Indice 1: (sourceType ASC, sourceId ASC)     → buscar transacciones vinculadas
Indice 2: (type ASC, date ASC)                → filtrar por tipo + rango de fecha
Indice 3: (sourceType ASC, date ASC)          → reportes por origen + periodo
Indice 4: (autoGenerated ASC, type ASC)       → separar manuales de automaticas

// En purchases collection
Indice 5: (paymentStatus ASC, date ASC)       → cuentas por pagar
Indice 6: (supplierId ASC, date ASC)          → historial por proveedor

// En closings collection
Indice 7: (date ASC)                          → rango de fechas (ya existe implicito)
```

### 6.6 Secuencia de Implementacion Recomendada

1. **Fase 1 — Extender modelo Transaction**: Agregar `sourceType`, `sourceId`, `autoGenerated`, `paymentMethod`
2. **Fase 2 — Integracion Cierres→Finanzas**: Generar transacciones automaticas al crear/editar/eliminar cierres
3. **Fase 3 — Integracion Compras→Finanzas**: Vincular compras a transacciones de gasto con sync de estado
4. **Fase 4 — KPIs Cross-Module**: Crear hooks unificados (`useFoodCost`, `usePrimeCost`, `useSalesMix`)
5. **Fase 5 — Documentos de Agregacion**: Pre-computar resumenes mensuales en `companies/{id}/aggregates/`
6. **Fase 6 — Reconciliacion**: Vista para detectar y resolver discrepancias entre modulos

---

## Sources

### Firestore Patterns
- [Write-time aggregations | Firestore](https://firebase.google.com/docs/firestore/solutions/aggregation)
- [Distributed counters | Firestore](https://firebase.google.com/docs/firestore/solutions/counters)
- [Transactions and batched writes | Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Aggregation queries | Firestore](https://firebase.google.com/docs/firestore/query-data/aggregation-queries)
- [Advanced Data Modeling with Firestore | Fireship.io](https://fireship.io/lessons/advanced-firestore-nosql-data-structure-examples/)
- [Bucket Pattern for Time Series Data](https://kelvinbz.medium.com/bucket-pattern-time-series-data-525b8257363b)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Denormalizing Your Data is Normal | Firebase Blog](https://firebase.googleblog.com/2013/04/denormalizing-your-data-is-normal.html)
- [Firestore Query Performance Best Practices 2026](https://estuary.dev/blog/firestore-query-best-practices/)

### Restaurant KPIs & Finance
- [10 Essential Restaurant Benchmarks 2026 | TouchBistro](https://www.touchbistro.com/blog/important-restaurant-benchmarks/)
- [Top 11 Restaurant KPIs | NetSuite](https://www.netsuite.com/portal/resource/articles/erp/restaurant-kpis.shtml)
- [Restaurant Break-Even Point | Lightspeed](https://www.lightspeedhq.com/blog/restaurant-break-even-point-analysis/)
- [Break-Even Analysis for Restaurants | Toast](https://pos.toasttab.com/blog/on-the-line/how-to-calculate-break-even-point)
- [Menu Engineering Matrix | Toast](https://pos.toasttab.com/blog/on-the-line/menu-engineering-matrix)
- [Menu Engineering Matrix | CrunchTime](https://www.crunchtime.com/blog/blog/restaurant-menu-engineering-matrix)
- [Cash Flow Management | TouchBistro](https://www.touchbistro.com/blog/cash-flow-management/)
- [Cash Flow Forecasting for Restaurants | Oboe](https://oboe.com/learn/restaurant-finance-and-operations-explained-1vx2vi6/cash-flow-management-and-financial-forecasting-restaurant-finance-and-operations-explained-5)
- [Restaurant Financial KPIs | MaintainIQ](https://maintainiq.com/the-essential-restaurant-kpis/)
- [7 Restaurant KPIs | Financial Models Lab](https://financialmodelslab.com/blogs/kpi-metrics/restaurant)

### Financial Integration & Architecture
- [CQRS Pattern | Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Event Sourcing and CQRS | Mia-Platform](https://mia-platform.eu/blog/understanding-event-sourcing-and-cqrs-pattern/)
- [CQRS in Event-Driven Systems | DEV Community](https://dev.to/cadienvan/cqrs-separating-the-powers-of-read-and-write-operations-in-event-driven-systems-47eo)
- [Double-Entry Accounting for Engineers | Anvil](https://anvil.works/blog/double-entry-accounting-for-engineers)
- [POS Reconciliation in 7 Steps | FitSmallBusiness](https://fitsmallbusiness.com/pos-reconciliation/)
- [Integrating POS with Accounting | SVA](https://accountants.sva.com/biz-tips/integrating-pos-systems-with-restaurant-accounting-software)
- [What is a Reconciliation API | Modern Treasury](https://www.moderntreasury.com/learn/what-is-a-reconciliation-api)
- [Event-Driven Architecture for Finance | Confluent](https://www.confluent.io/blog/event-driven-architecture-powers-finance-and-banking/)

### Colombian Specifics
- [Impoconsumo en Colombia | Alegra](https://blog.alegra.com/colombia/impoconsumo-en-colombia/)
- [Impuesto al consumo en restaurantes | Gerencie](https://www.gerencie.com/servicio-de-restaurante-frente-al-iva.html)
- [Impuesto Nacional al Consumo 2026 | SiempreAlDia](https://siemprealdia.co/colombia/impuestos/impuesto-nacional-al-consumo/)
- [Facturacion Electronica Colombia | Invoway](https://invoway.com/latam/blog/facturacion-electronica-colombia-guia/)
- [DIAN cierre restaurantes | El Colombiano](https://www.elcolombiano.com/negocios/cierre-la-puerta-falsa-restaurante-bogota-dian-facturacion-electronica-CF30176217)
- [NIIF para Pymes Colombia | Alegra](https://blog.alegra.com/colombia/que-son-las-niif/)
- [NIIF Pymes tercera edicion 2025 | SiempreAlDia](https://siemprealdia.co/colombia/contabilidad/niif-para-pymes-tercera-edicion/)
- [Grupos NIIF Colombia | Siigo](https://www.siigo.com/blog/contador/cuales-son-los-grupos-en-niif/)
- [Impuestos para Pymes Colombia 2025 | Bold](https://bold.co/academia/desarrollo-de-negocio/impuestos-para-pymes-en-colombia-2025-guia-practica-para-emprendedores)
