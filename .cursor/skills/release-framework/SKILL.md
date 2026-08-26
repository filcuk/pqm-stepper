---
name: release-framework
description: >-
  Release an SMA1 Framework version: SemVer bump FRAMEWORK_VERSION, update
  CHANGELOG.md, regenerate framework-manifest.json, verify, and create git tag
  vX.Y.Z. Use when cutting a framework release, bumping FRAMEWORK_VERSION, or
  publishing changelog notes.
---

# Release framework

For **framework maintainers** shipping a new `FRAMEWORK_VERSION`. Forks bumping their own app use `APP_VERSION` only — not this skill.

## SemVer (`FRAMEWORK_VERSION`)

| Bump | When |
| ---- | ---- |
| **MAJOR** | Breaking changes for forks (renamed APIs, removed features, mandatory path moves without aliases) |
| **MINOR** | New backwards-compatible components, APIs, or distribution surface |
| **PATCH** | Bug fixes, docs, non-breaking polish |

Update `FRAMEWORK_VERSION` in `app/version.js` to match. Keep `APP_VERSION` at `0.0.0` on this repo.

## CHANGELOG

Maintain root `CHANGELOG.md` in [Keep a Changelog](https://keepachangelog.com/) style:

1. Move items from `[Unreleased]` into a new `## [X.Y.Z] - YYYY-MM-DD` section (today’s date).
2. Group under Added / Changed / Fixed / Removed as needed.
3. Leave an empty `[Unreleased]` section for the next cycle.

## Catalogue, agent files, and lifecycle

1. Ensure [../_shared/component-map.md](../_shared/component-map.md) and [`scripts/lib/framework-catalogue.mjs`](../../../scripts/lib/framework-catalogue.mjs) match the tree (components **and** `AGENT_SKILLS` / `AGENT_RULES`).
2. **Moves (same id):** keep the id; set new `files`; list old paths in `previousFiles`. Never put a `previousFiles` / retired path back into a live `files` entry — `npm run manifest:framework` rejects path reuse.
3. **Deprecate → retire (two releases minimum):**
   - First release: add the id to `DEPRECATED` (still in `COMPONENTS` / `AGENT_SKILLS`) with `deprecatedIn`, optional `replacedBy` / `previousFiles`.
   - Later release: remove from the live map; add to `RETIRED` with `deprecatedIn`, `retiredIn`, and `previousFiles`. Manifest generation refuses retire without `deprecatedIn`.
4. Regenerate and commit the manifest:

```bash
npm run manifest:framework
```

5. Set `framework.lock.json` to `frameworkVersion` `X.Y.Z`, `schemaVersion` `2`, `"components": ["*"]`, `"skills": ["*"]`.
6. Run:

```bash
npm run verify:framework
npm run lint
npm test
```

## Checklist

- [ ] `app/version.js` `FRAMEWORK_VERSION` matches the new changelog section
- [ ] `.cursor/skills/_shared/component-map.md` matches the current component tree
- [ ] `scripts/lib/framework-catalogue.mjs` matches the component map + agent catalogues; `framework-manifest.json` regenerated (schema v2)
- [ ] Deprecate/retire / `previousFiles` updates follow the two-stage rules; no retired path reuse
- [ ] `framework.lock.json` `frameworkVersion` / `skills` match
- [ ] `npm run verify:framework` exits 0
- [ ] USAGE / AGENTS / demo updated for any shipped API (see `usage-docs.mdc`)
- [ ] Optional: regenerate README scroll media with `npm run capture:demo` when the demo changed materially (see [DEVELOPMENT.md](../../../DEVELOPMENT.md))
- [ ] `APP_VERSION` still `0.0.0`
- [ ] **Git tag `vX.Y.Z` created** on the release commit (mandatory — sync fetches by tag)

## Tagging (mandatory)

After the release commit exists locally:

```bash
git tag -a "vX.Y.Z" -m "SMA1 Framework vX.Y.Z"
```

- Do **not** push the tag unless the user asks.
- Do **not** skip the tag: untagged `FRAMEWORK_VERSION` values break `npm run sync:framework` fetch mode for forks.
- If a version was published without a tag historically, create the annotated tag on the version-bump commit as soon as practical (example: `v0.9.0` → commit that set `FRAMEWORK_VERSION` to `0.9.0`).

## Finish

Run **`health-check`**. Summarize the release notes for the commit/PR body. Remind the user that forks need the pushed tag before `--version` sync works against GitHub.
