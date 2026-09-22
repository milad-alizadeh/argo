---
name: setup-domain-boundaries
description: Install a port-only cross-domain import rule (reach another module only through its public entry file) with dependency-cruiser, generalized to any layer map.
disable-model-invocation: true
---

# Setup Domain Boundaries

Install one rule: a module may reach another module only through that module's public entry
file, never by importing an internal path directly. This works in any project split into
named domains or layers, whatever those layers are called locally. Argo's own instance is
`.dependency-cruiser.json` and [ADR-0044](../../../../docs/adr/0044-product-domains-use-runtime-facets.md);
read them as a worked example, not as the rule to copy verbatim — copy the shape, name your own
layers.

## 1. Name your layer map

Write down, for this repo:

- **The layer root.** One directory each domain lives under (Argo's:
  `apps/desktop/src/domains/<domain>/`).
- **The layers inside a domain**, and which of them is the *port* — the one file or directory
  another domain is allowed to import (Argo's: `contract`, `main`, `preload`, `renderer`, with
  `port.ts` as the port per domain). A project with no internal layers still has this decision
  to make once: which single entry point (`index.ts`, a barrel, the domain's top-level file)
  counts as its port.
- **The layers that are exempt** because nothing outside their own domain should reach them at
  all — usually every layer except the port.

This map is the whole generalization: everything below reads it back, never a domain's real
name.

## 2. Confirm the one precondition: relative imports are already banned

The rule below matches an import **string**, not a resolved file. That is sound only if every
cross-directory import already goes through one canonical alias — `@/domains/<domain>/...` in
Argo — because a relative import (`../../other-domain/main/store`) reaches the same file under a
string the rule never sees.

Confirm this repo already forbids `../` and nested `./` imports (Biome's own
`noRestrictedImports` `group: ["../*", "./*/*"]` is Argo's version) before writing the boundary
rule. If it does not, add that ban first. **Relaxing it later silently voids the boundary rule**
it was written to make sound: record that dependency next to the rule itself, not only here.

## 3. Pick one path-alias convention

One alias root that maps to the layer root from step 1 (Argo's: `@/domains/<domain>` →
`apps/desktop/src/domains/<domain>`, via `tsconfig.json` paths and the bundler's matching
alias). Without it, step 4's rule has no canonical string to match against.

## 4. Write the port-only rule with a backreference, not one override per domain

State it once, as one rule with a captured group, rather than one hand-written block per domain
name:

```json
{
  "forbidden": [
    {
      "name": "domain-port-only",
      "severity": "error",
      "comment": "A domain reaches another domain's internal layers only through its port file.",
      "from": { "path": "^<layer-root>/([^/]+)/" },
      "to": {
        "path": "^<layer-root>/[^/]+/(<internal-layers>)/",
        "pathNot": ["^<layer-root>/$1/", "/<port-file>$"]
      }
    }
  ]
}
```

`$1` is the domain name `from` captured; `pathNot` re-admits imports back into the *same*
domain and imports of *any* domain's port file. Everything else matching `to.path` is refused.
One rule covers every domain the layer root holds today or gains later — a new domain needs no
new block.

### Why dependency-cruiser, and not the linter already in the repo

Try the project's linter first if it has a restricted-import rule; Argo did (Biome's
`noRestrictedImports`) and rejected it for this one rule, for a reason that generalizes to any
linter whose restricted-import rule matches literal specifier strings rather than resolved
paths:

- **Biome's `overrides` array does not merge one rule's config across blocks that both match a
  file.** Only the last matching block wins whole. A per-domain override list (one block per
  domain, each banning the others) is exactly the shape that collides with any other override
  touching the same paths — the config depends on block order rather than reading as one rule.
- **Biome has no regex-backreference primitive.** Stating "reach domain X only through
  `X/port.ts`" as one rule needs `to.pathNot` to reference what `from.path` captured. Biome's
  `no-restricted-imports` bans a fixed glob list; it cannot say "this domain, whichever one
  matched." `biomejs/biome` discussion #6245 is the open, unimplemented request for Nx-style
  module-boundary enforcement, and #5595 — closed — is where a Biome maintainer confirmed
  `noRestrictedImports` is the only current workaround, which is the fixed-glob-per-block form
  this recipe avoids.
- dependency-cruiser's `from`/`to` pair with a captured group is a two-line answer to the same
  question, in one rule instead of one block per domain.

Accept what this trades away: the rule matches an import **string**, not what the compiler
resolves it to. With the relative-import ban from step 2 in place, the two agree for every
import the project can currently write — but a future alias remap or re-export chain could
make them disagree. That is a deliberate trade of resolution fidelity for one engine and one
rule.

## 5. Wire it into the gate that already runs

Add the dependency-cruiser run as its own script (Argo: `quality:boundaries`) inside the
aggregate quality command, not folded into the linter step — a boundary violation should read
as its own failure, not a lint failure with a different rule name.

## 6. Prove it fires, then remove the proof

Add an import that reaches into another domain's internal layer (not its port), confirm the
gate rejects it, then remove the import. Add an import of that domain's port file and confirm
it passes. Do this against the rule you just wrote, in this repo — a proof run in a different
project or against an earlier draft of the config does not carry over.

## What this does not cover

- **A composition root** (an entry point that legitimately wires several domains together) needs
  its own carve-out, spelled out as its own `pathNot` entries or a separate rule; it is not part
  of the layer map in step 1 and inherits no exemption automatically.
- **Import cycles.** This rule is directional (who may reach whom), not cyclical (does a reach
  loop back). A cycle check is a separate rule, out of scope here.
