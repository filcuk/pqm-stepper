---
name: finalize-app
description: >-
  Review a finished microapp fork and remove unused framework components, CSS
  partials, vendor bundles, and demo files using the shared component map. Use
  when finalizing, trimming unused components, or cleaning up before ship.
---

# Finalize app

Remove unused catalogue pieces after the app’s feature set is stable. Read [../_shared/component-map.md](../_shared/component-map.md) and [../_shared/invariants.md](../_shared/invariants.md).

## Workflow

### 1. Discover used features

1. List root HTML entry points and their `type="module"` scripts.
2. Trace transitive imports under `app/`.
3. Scan markup for feature hooks (classes / `data-*`): e.g. `.tabs`, `.modal`, `.dropdown`, `.file-dropzone`, `.code-block`, `data-expandable-surface`, `.banner`, `.date-picker`, etc.
4. Mark each component-map `id` as **used** or **unused**. Shell-pulled `tooltip` and `banner` stay **used** while `initShell` remains.

### 2. Propose deletion plan

Present before deleting:

| Unused id | JS to remove | CSS / vendor impact |
| --------- | ------------ | ------------------- |
| … | … | … |

Also list:

- CSS partials safe to drop (no remaining consumer in the map)
- Vendor trees (`app/vendor/prism/`, Toast UI, …) if unused
- Demo: `demo.html` / `app/demo.js` if not intentionally kept
- `framework.lock.json` `components` list to shrink to remaining ids
- `framework.css` `@import` lines to remove (or regenerate via sync after updating the lock)
- `pages.yml` updates

**Never** remove Always keep paths, shell-required icons, or invariants.

### 3. Confirm, then delete

Get explicit user approval. Then:

1. Update `framework.lock.json` `components` to the kept set (not `"*"` unless everything remains).
2. Delete unused component JS (and exclusive vendor/CSS), **or** run `npm run sync:framework -- --from <upstream>` after the lock change and remove leftover `unexpected` files reported by verify.
3. Drop unused `@import`s from `app/css/framework.css` (sync regenerates this when used); delete orphaned partial files.
4. Update `pages.yml` if demo HTML was removed.
5. Remove stale demo links from `index.html` / docs if present.
6. Do not strip framework icon catalogue entries that shell or remaining features still need; optional cleanup of unused ids in `icons-app.js` only.

### 4. Finish

```bash
npm run verify:framework
```

Then run **`health-check`** (include optional unused scan — expect clean or only intentional leftovers).
