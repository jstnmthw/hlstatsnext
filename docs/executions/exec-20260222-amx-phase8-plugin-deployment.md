# Execution Log: Phase 8 — AMX Mod X Plugin Deployment

**Date:** 2026-02-22
**Phase:** 8.1 (AMX Mod X Plugin)
**Review Doc:** `docs/reviews/review-20260215-1400-token-auth-final.md`
**Status:** Complete

---

## Baseline

- **Compiler:** amxxpc 1.9.0.5294 (Linux x86)
- **Target Runtime:** AMX Mod X 1.10-5474 (Linux & Windows)
- **Pre-change binary size:** ~15,000 bytes (estimated)
- **Pre-change warnings:** 0
- **Pre-change errors:** 0

---

## Security Research (Pre-Implementation)

Researched AMX Mod X cvar protection mechanisms for secure token handling:

| Flag              | Value | Purpose                                                         |
| ----------------- | ----- | --------------------------------------------------------------- |
| `FCVAR_PROTECTED` | 32    | Masks cvar value from external access (clients, status queries) |
| `FCVAR_UNLOGGED`  | 256   | Prevents cvar changes from being logged to console/files        |
| `FCVAR_SPONLY`    | 64    | Prevents client-side modification                               |

**Decision:** Use all three flags combined (`FCVAR_PROTECTED | FCVAR_UNLOGGED | FCVAR_SPONLY`) to ensure the token cannot be read by clients, logged by the engine, or modified by connected players.

**Delivery mechanism:** `engfunc(EngFunc_AlertMessage, at_logged, ...)` confirmed as the correct way to emit messages through the `logaddress_add` pipeline (verified in `fakemeta_const.inc`).

Sources consulted:

- AMX Mod X API Reference (amxmodx.org/api/cvars)
- AlliedModders Wiki - Scripting Cvars
- Bundled `cvars.inc`, `fakemeta_const.inc` headers

---

## Changes Made

### New File: `src/include/hlstatsnext_auth.inc`

Auth beacon module implementing:

- `hlstatsnext_auth_init()` — Registers `hlx_token` cvar with protection flags
- `hlstatsnext_auth_start()` — Reads game port, sends initial beacon, schedules repeating task
- `hlstatsnext_auth_stop()` — Cleans up repeating task
- `send_auth_beacon()` — Emits `HLXTOKEN:<token>:<gamePort>\n` via engine log pipeline
- `task_auth_beacon()` — Public callback for `set_task()`

Security controls:

- Token value NEVER appears in any `log_amx()`, `console_print()`, or player message
- Debug logging only shows token _length_ and _port_, never the value
- Token validated >= 10 chars before sending (catches empty/trivially invalid tokens)
- Beacon only sent when plugin is active
- Task cleaned up on plugin shutdown

### Modified: `src/hlstatsnext.sma`

- Added `#include "include/hlstatsnext_auth.inc"`
- `plugin_init()`: Added `hlstatsnext_auth_init()` call
- `plugin_cfg()`: Added `hlstatsnext_auth_start()` call (after config load)
- `plugin_end()`: Added `hlstatsnext_auth_stop()` call (before cleanup)

### Modified: `configs/hlstatsnext.cfg`

- Added `hlx_token ""` with documentation explaining it's a credential

---

## Compile Result

```
AMX Mod X Compiler 1.9.0.5294
Header size:           1464 bytes
Code size:            30036 bytes
Data size:            19796 bytes
Stack/heap size:      16384 bytes
Total requirements:   67680 bytes
Done.
```

- **Warnings:** 0
- **Errors:** 0
- **Binary size:** 16,619 bytes
- **Binary path:** `compiled/hlstatsnext.amxx`

---

## Runtime Validation

Runtime testing deferred (no test server available in this session). Expected behavior:

1. Plugin loads, registers `hlx_token` cvar (value masked from clients)
2. Server config sets `hlx_token` value
3. `plugin_cfg()` fires, beacon emits `HLXTOKEN:<token>:<port>` through UDP log pipeline
4. Beacon repeats every 60 seconds
5. Daemon receives beacon, authenticates server, caches source IP:port mapping

---

## Risks

| Risk                                | Mitigation                                                    |
| ----------------------------------- | ------------------------------------------------------------- |
| Token leaked via server logs        | FCVAR_UNLOGGED prevents engine logging; no log_amx of value   |
| Token read by connected clients     | FCVAR_PROTECTED masks value; FCVAR_SPONLY blocks client set   |
| Beacon sent with empty token        | Length validation skips beacon if token < 10 chars            |
| Task not cleaned up on map change   | `plugin_end()` calls `hlstatsnext_auth_stop()`                |
| Compiler version vs runtime version | 1.9.0 compiled binary is forward-compatible with 1.10 runtime |

---

## Recommended Next Phase

Phase 8.2: SourceMod Plugin implementation (same beacon protocol, SourceMod-specific API).
