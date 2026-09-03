---
paths:
  - "apps/**/*.swift"
  - "packages/**/*.mjs"
  - "scripts/**/*.mjs"
---

# Code Style

How code reads on the page. Shape, not syntax, so it binds every language in the repo;
`swift-style.md` names how Swift spells each rule.

**The arithmetic is a gate, not a rule here.** Function length, cognitive complexity,
parameter count, file length, nested ternaries, `else` after `return`, unused code and
checker-silencing pragmas all fail the build: `biome.jsonc` for JavaScript and
`apps/macOS/.swiftlint.yml` for Swift, every rule an error. Write to those caps; when one
fires, fix the code or ratchet the exemption where the config keeps it, never suppress
inline (`docs/agents/quality-gates.md`). What follows is only what no linter can see.

## Branch on a closed set with the exhaustive construct

When the condition is one of a known, closed set of values, use the construct the compiler
checks for exhaustiveness. Reserve chained `if` for genuinely open conditions: range checks,
truthiness, arbitrary booleans. The reason is the next variant: an exhaustive construct fails
loudly when a case is added, a chain of `if`s silently falls through and ships the bug.

**Selecting a value is not branching.** When the discriminant only picks *which value* to use
(a style, a label, a threshold), a lookup keyed by the discriminant beats both. Branch when the
cases *do* different things, look up when they *are* different things.

## Guard clauses, not nesting

Handle the exceptional case first and leave. The happy path stays at one indent level, at the
bottom, unwrapped. A conditional whose body is the rest of the function is inverted. Three
levels of nesting is the signal that the inner levels are a separate function.

## Three parameters, then a structure

A fourth positional parameter is a structure instead. Two booleans in a row is already the
smell, at any arity: name them or split the function.

## One unit per file

A file owns exactly one thing, named by what it owns. Pure-data files and declarative catalogs
are exempt from the length gate; nothing else is.

## Don't name what you use once

A single-use local that only restates the expression adds a hop without meaning. Inline it.
Keep the name when it encodes a unit, a domain term, or a why the expression can't state.

## Names are words, not abbreviations

`percentage` not `pct`, `context` not `ctx`, `repository` not `repo`, for every name a reader
meets, user-visible labels included. Exceptions: an acronym that is the domain's own name
(`URL`, `ID`, `CI`) and a name the platform fixes (`self`, `args`).

## Validate at the boundary, don't assume

Data crossing in from outside (a network response, a parsed file, an environment variable) is
unknown until something checks it. Parse it into a known shape at the edge, once, and let
everything inward rely on that. A cast or a type annotation standing in for a check is
forbidden, and so is re-checking the same payload deep in the call stack.

## Silencing the checker needs a named constraint

The gate forbids the pragmas. The one sanctioned use is an external constraint you can't fix
from here (an upstream bug, a generated file), and it carries a comment naming that constraint
and, where relevant, the version that removes it.
