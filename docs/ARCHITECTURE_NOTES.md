# Architecture Notes

This note defines the baseline architecture for Cloud Atlas OS so complexity stays low as features grow.

## Design goals

- One behavior, one owner.
- Thin call paths (avoid pass-through wrappers).
- Clear layer boundaries.
- Shared primitives instead of duplicated helpers.

## Layer schema

- `UI` (`.svelte` components)
  - Renders state and dispatches user intent.
  - No data-fetch loops, relay orchestration, or persistence plumbing.
- `Store`
  - Owns reactive state and state transitions.
  - Uses shared persistence helpers where needed.
- `Services / Data manager / IDB`
  - Owns IO and orchestration (Nostr, cache, snapshots, deletes).
  - Keeps domain flow logic close to where events are fetched/published.
- `Utils`
  - Pure reusable primitives (Cesium helpers, formatting, common transforms).
  - No hidden side-effect orchestration.
- `Types`
  - Shared contracts for data shape and event payloads.
- `Shared components`
  - Reusable visual shells/patterns used by multiple screens.

## Rules for complexity control

- Do not add wrapper functions that only forward calls.
  - If a function only does `a -> b` with no policy/validation/metrics, call `b` directly.
- Add a wrapper only when it adds clear behavior:
  - retry policy
  - sync/verification strategy
  - cross-cutting metrics/logging
  - input normalization/validation
- Keep domain flow files strategy-focused:
  - example: map feed vs geohash feed chooses strategy
  - shared helpers own event dedup/parse loops
- Prefer option-driven branching in one primitive over duplicate helper families.

## Current single sources of truth

- Cesium camera toggling + pulse ring primitives: `src/utils/cesiumHelpers.ts`
- Modal state ownership: `src/utils/modalManager.ts`
- Mission modal/domain workflows: `src/services/modalWorkflows.ts`
- Feed event collection primitives: `src/services/listingFeedHelpers.ts`
- Local persistence helpers: `src/utils/persistedState.ts`
- Mission screen shared shell: `src/components/shared/MissionFrame.svelte`

## PR checklist (must pass)

- Can this behavior be found in one primary module?
- Did I avoid adding new pass-through wrappers?
- Does this change keep UI/store/service/util boundaries clear?
- If similar logic exists, did I extend existing primitive instead of duplicating it?
- Did I remove obsolete duplicate code in the same PR?
