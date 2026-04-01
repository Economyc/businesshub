---
phase: 1
slug: dashboard-home-inteligente
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test infrastructure in project |
| **Config file** | None |
| **Quick run command** | N/A |
| **Full suite command** | N/A |
| **Estimated runtime** | N/A — manual verification only |

---

## Sampling Rate

- **After every task commit:** Manual visual check in browser
- **After each wave:** Full manual smoke test of all dashboard sections

---

## Phase Requirements → Test Map

| Behavior | Test Type | How to Verify |
|----------|-----------|---------------|
| KPIs render with correct values | Manual smoke | Open /home with selected company, compare values to /analytics |
| AreaChart shows 30 days with no gaps | Manual visual | Inspect chart renders contiguous line even on days with 0 income |
| Alerts list correct severity order | Manual | Add test data: expired supplier + expiring contract, verify critical appears first |
| Quick actions navigate correctly | Manual | Click each button, verify route |
| Multi-company fallback still works | Manual | Deselect company or navigate with no selection |
| No crash without DateRangeProvider | Dev tools | Open browser console, no "useDateRange" errors |

---

## Wave 0 Gaps

- No test framework installed. Verification is manual.
- No formal requirement IDs mapped to this phase.
