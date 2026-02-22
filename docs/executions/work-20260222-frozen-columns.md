# Next.js v16 Work Log — frozen-columns

## Request

Add `frozenColumnsLeft` and `frozenColumnsRight` props to the DataTable component to support CSS sticky frozen columns. Apply to the admin servers datatable: freeze "select" (left) and "actions" (right).

## Context captured

- Runtime introspection: Partial (dev server on port 3001, no MCP tools exposed)
- Affected routes/layouts: `/admin/servers`

## Changes made

### Summary

Added frozen (sticky) column support to the shared `DataTable` component via two new optional props. Uses `position: sticky` with measured pixel offsets computed in `useLayoutEffect`. Frozen cells get a solid `bg-background` with proper hover/selection state handling via Tailwind's named `group/row` pattern.

### Files touched

- `apps/web/src/features/common/components/data-table.tsx` — Added `frozenColumnsLeft`/`frozenColumnsRight` props, measurement logic via `useLayoutEffect`, and frozen cell styling (sticky positioning + background)
- `apps/web/src/features/admin/servers/components/admin-servers-table.tsx` — Applied `frozenColumnsLeft={["select"]}` and `frozenColumnsRight={["actions"]}`

### Implementation details

- **Measurement**: `useLayoutEffect` queries header `<th>` elements after render, measures `offsetWidth`, and computes cumulative left/right offsets for each frozen column
- **Styling**: Frozen cells receive `position: sticky`, computed `left`/`right` offset, and `zIndex: 2` via inline styles
- **Background**: Frozen header cells get `bg-background`. Body cells get `bg-background` with `group-hover/row:bg-muted/50` and `group-data-[state=selected]/row:bg-muted` to properly respond to row hover and selection states
- **Multiple columns**: Supports multiple frozen columns per side with cumulative offset stacking

## Rationale

- CSS `position: sticky` on `<th>`/`<td>` is the standard approach for frozen table columns in scrollable containers
- `useLayoutEffect` ensures styles are applied before the browser paints, preventing visual flash
- Named group pattern (`group/row`) ensures frozen cells properly reflect row hover/selection states without modifying the base `TableRow` component in `packages/ui`

## Verification

- `pnpm --filter web run check-types` — passed
- `pnpm --filter web run lint` — passed (0 warnings)

## Follow-ups

- Consider adding a subtle box-shadow to edge frozen columns for visual separation when scrolling
- Consider adding `ResizeObserver` to re-measure if column widths change dynamically (e.g., window resize)
- Consider setting `enableHiding: false` on the "actions" column definition to prevent hiding a frozen column
