# Engineering Refactor Guidelines — Cyclomatic Complexity & Practical Decomposition

This document outlines how to evaluate, refactor, and structure code within our project using meaningful metrics — primarily **Cyclomatic Complexity (CC)** — without falling into "indirection hell." It serves to inform thoughtful refactoring decisions across other modules, just as was done with the `Ingress Adapter`.

---

## Purpose

Enable automated or assisted refactoring (e.g., via Cursor AI) by:

- Evaluating whether a file or function is **too complex to maintain or test**
- Identifying **logical boundaries** to split responsibilities cleanly
- Preventing unnecessary indirection by respecting **project ergonomics**

---

## Step-by-Step Refactor Philosophy

### Step 1: Measure Cyclomatic Complexity

For each function or class method:

- Count decision points (`if`, `else`, `switch`, `case`, `try`, `catch`, loops, ternary)
- Apply: `CC = 1 + number of decision points`

#### Evaluation Thresholds:

| CC Value | Meaning                | Action                |
| -------- | ---------------------- | --------------------- |
| 1–5      | Simple & Clean         | ✅ Leave it as-is     |
| 6–10     | Moderate, but watch it | ⚠️ Consider splitting |
| >10      | High complexity        | 🚨 Refactor required  |

> **Note:** Aggregate CC across a file (e.g. 50+) is okay if individual units remain manageable.

---

### Step 2: Analyze What the Code is _Doing_, Not Just Its Size

Use CC as a signal, not a mandate. For each unit, ask:

- Is this **one logical responsibility**?
- Can this be **easily tested in isolation**?
- Do I need to keep the whole function in my head to reason about it?

If the answer is "no" to any of those → **refactor**.

---

### Step 3: Choose The Right Kind of Split

Avoid creating excessive files or over-abstracting prematurely. Prefer splitting by **responsibility**, not just by size.

#### Common refactor targets:

| Concern                   | Target Destination                           |
| ------------------------- | -------------------------------------------- |
| Validation logic          | `shared/application/validators/`             |
| Low-level utilities       | `shared/application/utils/`                  |
| DB seeding logic          | `modules/<domain>/seeders/`                  |
| Orchestration             | `modules/<domain>/orchestrators/`            |
| External service wrappers | `modules/<domain>/adapters/`                 |
| Entity construction       | `modules/<domain>/factories/`                |
| Types                     | `modules/<domain>/types/` or `shared/types/` |

---

## Example: Ingress Adapter Refactor

**Original:** Monolithic class handling:

- Address/port/game validation
- Authentication cache
- DB lookups
- GeoIP enrichment
- Server creation logic

**Problems:**

- Multiple responsibilities
- Function CC between 6–9
- Low testability of internals

**Refactored into:**

```
modules/ingress/
├── adapters/
│   └── database-server-authenticator.ts
├── factories/
│   └── ingress-dependencies.ts

modules/server/
├── orchestrators/server-orchestrator.ts
├── factories/server-factory.ts
├── enrichers/geoip-enricher.ts
├── seeders/
│   ├── seed-server-defaults.ts
│   ├── seed-game-defaults.ts
│   └── seed-mod-defaults.ts

shared/application/validators/
├── address-validator.ts
├── port-validator.ts
├── game-code-validator.ts

shared/application/utils/
└── ip-utils.ts
```

Each file is now:

- ✅ Dedicated to one task
- ✅ Has low CC (1–5 typical)
- ✅ Testable in isolation
- ✅ Named after what it does

---

## Apply This Thinking to Any File

### For Cursor AI:

When analyzing other files:

1. Measure function-level CC
2. Flag anything over **7** for review
3. Ask: _"Can I reason about this unit easily and test it in isolation?"_
4. Refactor by extracting to the appropriate concern bucket above
5. Do **not** break apart small, clear, cohesive logic just to reduce CC

### Prioritize Refactoring When:

- File exceeds **300+ lines** with unclear sections
- You see **duplicate patterns** (e.g. similar seeding logic across modules)
- Logic couples **DB, validation, caching, and orchestration** together

---

## Refactor Success Criteria

Each refactor should:

- Keep each method/function < **7 CC** where possible
- Reduce overall lines per file to < **250** ideally
- Use dependency injection for services
- Move validations to shared validators
- Separate pure logic from side effects

---

## Golden Rule

> Cyclomatic Complexity is a **code smell**, not a death sentence.
> Refactor for **clarity and maintainability**, not just for metrics.

Use this document as the **thinking framework** to scale this philosophy to the rest of the codebase.

---

## Feedback

Engineers are encouraged to suggest refinements to this document based on future refactors or team learnings.
