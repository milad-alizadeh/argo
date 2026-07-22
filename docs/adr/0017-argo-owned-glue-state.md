# 0017 · Argo-owned glue state: the Project registry and user-asserted links

Status: accepted (#182) · 2026-07-22

## Context

The #182 domain rebuild pinned down exactly what Argo *owns* versus *observes*. Every source
of truth is external and already has a home: Work Items live in a project-management provider
(GitHub/Linear), Delivery truth in a code host, Sessions in the CLIs' own transcript files.
Argo owns only the **glue** between them — and the question was where that glue lives and in
what form.

ADR-0008 already settled "files only, no database, `userData`, derived layer is a cache,
roster is discovered not persisted." But it explicitly wrote *nothing* about a Project
registry ("Argo writes nothing about which-Sessions-exist") and predated the L1 relationship
model, which introduced one edge — a branchless session pinned to a ticket — that has **no
external signal** and therefore cannot be derived.

## Decision

- **Almost none of the glue is owned truth — it is derived.** Which branch a session is on
  (its `cwd`/git), which work item a branch serves (join precedence: native-ref →
  id-in-branch → unlinked, ADR-0014), PR/CI/review state (code host) — all derivable. The
  **Hub** assembles the full join across Sessions/Deliveries/Work Items **in memory on
  launch** and holds it as a throwaway projection (the `CockpitState`/`HubEvent`/
  `ProjectionDelta` spine). It is never persisted as truth — persisting a derived join is the
  drift bug ADR-0008 killed the SQLite mirror to avoid.

- **Two — and only two — new categories of owned state are persisted**, both as plain files
  in per-machine `userData` (never committed to a repo; sessions, paths, and registration are
  per-machine):
  1. **Project registry** — the set of known Projects (stable id + repo root path + optional
     port config) and which one is active. This is what a window reads on launch to know what
     it can open.
  2. **User-asserted links** — the `Session → Work Item` edge for a session with no branch
     (hence no Delivery, hence no derivable link). This is the sole relationship a human
     assertion creates that nothing external records.

- **Everything else stays derived or CLI-owned** per ADR-0008: the Session roster is
  discovered by scanning CLI transcript dirs; the derived layer (Outcomes, CONVENTION
  reports) is the cache ADR-0008 describes.

- **SQLite, if it ever returns, is only ever a rebuildable cache/index** (e.g. `sqlite-vec`
  recall over the future markdown vault) — never a source of truth. Deferred until profiling
  on low-spec hardware forces it; even then it is a cache you can delete and rebuild, not
  truth.

## Why

- Persisting only the irreducibly-owned bits (registry + user-asserted links) keeps the drift
  surface minimal — everything derivable is re-derived, so it cannot go stale against the
  external truth it mirrors.
- Per-machine `userData` is correct because Projects are naturally per-machine: two machines
  have different repo paths and different live sessions; committing glue to the repo would
  make collaborators and a user's own second machine clobber each other.
- Files-first is the least-intrusive footprint and matches how the CLIs themselves persist
  (ADR-0008) — Argo's own state uses the same substrate as everything it observes.

## Consequences

- ADR-0008's "no persisted roster" stands for Sessions; this ADR adds the Project registry
  and the one user-asserted link as the *only* owned-state files, alongside 0008's derived
  cache.
- The Hub gains an explicit contract: assemble the join from filesystem + providers + code
  host on launch; treat the assembled join as disposable; persist only registry + asserted
  links.
- v1 ships GitHub/Linear as the only Work Item providers (both remote, OAuth — ADR-0018); a
  local-file/vault provider is descoped.
