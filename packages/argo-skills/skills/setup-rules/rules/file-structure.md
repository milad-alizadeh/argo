---
paths:
  - "{{SOURCE_GLOBS}}"
---

# File Structure Rules

Where code lives, and which parts of a module the rest of the codebase may see. Structure
rather than syntax, so it binds every language in the repo. This repo's module entry is
`{{PUBLIC_ENTRY}}`.

Where the repo runs placement gates (`setup-module-boundaries`: a file loose at a module root,
a kind-folder, an unearned shared symbol) and a boundary linter (imports that bypass an entry
or cross a layer), those fail the build and this file does not restate their numbers.

## Extract before you dump

When a file nears the line ceiling, a folder root accumulates 5+ peer files, or two files
share a prefix (`orderCreate`, `orderCancel`), extract into a subfolder behind one entry:

```
thing/
  {{PUBLIC_ENTRY}}   # orchestrator only: wires sub-units together, re-exports the API
  partA              # one focused unit
  partB              # one focused unit
```

The entry is wiring and re-exports only; no business logic lives there. Callers keep
importing `thing`. Do this while authoring a feature, not as a follow-up.

## Group by domain, not by file type

Folders are named by what the code is for: `checkout/`, `user-profile/`, never `utils/`.
**Kind-folders are banned**: `schemas/`, `types/`, `utils/`, `helpers/`, `constants/`,
`validators/`, `handlers/` as grouping folders become junk drawers, and deleting a feature
leaves orphans in each. A feature's schema, types and validation live inside its folder.

Not banned, because none is a grouping folder you chose: a file named after its kind inside a
domain folder (`checkout/schema`), a folder the framework or a tool reserves (a router
directory, a migrations folder), and a vendored-primitive folder a component kit generates
into. An existing kind-folder outside those is debt: leave it until you next touch that
feature, and don't add to it.

## Shared code is earned: hoist on the third caller

A helper is born next to its only caller. With two callers, copy it or hoist; with three,
hoist. Two destinations: the **shared tier** (`{{SHARED_TIER}}`) for anything naming a domain
term, and the **generic tier** (`{{GENERIC_TIER}}`) for what would stand alone as its own
package, importing nothing from the app. Neither exists until a third caller creates it.

**Imports flow upward only.** A domain may import both tiers; shared may import generic;
generic imports neither. A sibling-domain import means the shared thing wants hoisting; a
domain type inside the generic tier means that file wants demoting.

Abstractions designed from one example encode that example's accidents; by the third you can
see which parts are the shape.

## Keep subfolders shallow

One level of nesting covers almost every case. Never go deeper than two levels below the
module root without a documented reason.

## Public entry per module

Every module exposes ONE public entry that is its API; callers never import an internal leaf.
The exception: one symbol from a leaf where the entry would re-export a very large surface.

## Module boundaries: ports and adapters

- **Depend on ports, not implementations.** When module A needs behaviour module B provides,
  A consumes an interface or registry and B registers into it.
- **Layering is one-directional.** Generic layers never import specific ones; two specific
  layers never import each other's internals. In this project: {{LAYER_BOUNDARY}}
- **Registration side-effects happen in ONE composition root**, never scattered.
- **No god nodes.** Extreme fan-in or fan-out is single-responsibility violated at graph
  scale; split by responsibility.

Justified violations (vendored code, a migration in flight) go in the boundary linter's
ignorelist, each entry one rule, one path glob, one reason. Never loosen the rule globally,
never an inline disable.
