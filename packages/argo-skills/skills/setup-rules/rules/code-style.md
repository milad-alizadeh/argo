---
paths:
  - "{{SOURCE_GLOBS}}"
---

# Code Style

How code reads on the page. These rules are about shape, not syntax, so they bind
**every language in this repo** equally — a 200-line function is unreadable in every
language that has functions.

Each rule below is the *intent*. Where a language has its own spelling for one — its
exhaustive branch construct, its checker-silencing pragmas, its file-naming
convention — the `<language>-style.md` file next to this one names it. This file is
what they all agree on; that file is how one of them says it.

## Branch on a discriminant with the exhaustive construct

When the condition is one of a known, closed set of values — a variant tag, an enum, a
status — use the construct your language checks for exhaustiveness; the binding next to
this file names it, and names how to make a missed case fail. Reserve chained conditionals
for genuinely open conditions: range checks, truthiness, arbitrary booleans.

The reason is the next variant, not this one. An exhaustive construct fails loudly when
someone adds a case; a chain of `if`s silently falls through to the default and ships
the bug.

## No nested conditional expressions

One level of inline conditional is fine. Chaining them is forbidden — the second level
reads as one expression but branches like three. Use the exhaustive construct or early
returns.

## Guard clauses, not nesting

Handle the exceptional case first and return, throw, or continue out of it. The happy
path stays at one indent level, at the bottom, unwrapped.

- **Forbidden:** a conditional whose body is the entire rest of the function. Invert it
  and leave early.
- **Forbidden:** an `else` after a branch that already returned — the `else` is noise.
- Three levels of nesting in one function is the signal: the inner levels are a separate
  function, or the outer ones are guards you haven't inverted yet.

## Three parameters, then a structure

A fourth positional parameter is forbidden — pass one named structure instead, whatever
this language calls that. Positional arguments encode order at every call site, and order
is invisible there: nobody reads `render(node, true, false, 2)`.

Two booleans in a row is already the smell, at any arity: either name them or split the
function.

## One unit per file, and a line ceiling

A file owns exactly one thing — one component, one class, one state machine, one
top-level function — named by what it owns. Soft ceiling of **~150 lines** — this file is
where that number lives; pure-data files and generated output are exempt, and
`file-structure.md` covers where the pieces go when a file outgrows it.

If you can't say what the file does in one sentence without "and", it's two files.

## Don't name what you use once

A single-use local that only restates what the expression already says adds a hop for
the reader without adding meaning. Inline it.

Keep the name when it earns one: the expression is used twice, or the name encodes a
unit, a domain term, or a why the expression can't state (`isPastCutoff`). This is the
counterweight to over-extraction, not a licence to nest calls four deep — if inlining
makes the line unreadable, the name was earning its place.

## Names are words, not abbreviations

Spell identifiers out: `percentage` not `pct`, `context` not `ctx`, `configuration` not
`cfg`, `repository` not `repo`. This covers every name a reader meets — variables,
parameters, fields, functions, types, CSS classes **and user-visible labels**. A gauge
labelled `CTX` is as unreadable as a field named `pct`.

Two exceptions: an acronym that is the domain's own name (`URL`, `HTML`, `ID`, `API`,
`CI`), and a name the platform fixes for you (`self`, `args`, `props`). Those still
follow the language's casing convention rather than shouting.

## Validate at the boundary, don't assume

Data crossing into your program from outside — a network response, a parsed document, an
environment variable, a file, a queue message — is unknown until something checks it.
Parse it into a known shape at the edge, once, and let everything inward rely on that.

- **Forbidden:** declaring the shape of external data without checking it — a cast, an
  unchecked deserialization, a type annotation standing in for a validation.
- **Forbidden:** re-checking the same payload deep in the call stack because nobody
  trusts the edge. If it's being re-checked, the edge didn't do its job.

## Don't disable the checker

Every language ships a way to silence its own type checker or linter. Reaching for one
converts a compile-time error into a runtime one and hides it from everyone downstream.
Fix the type, narrow the value, or restructure the code.

The one sanctioned use is an external constraint you can't fix from here — an upstream
bug, a generated file, a genuine boundary — and it comes with a comment naming that
constraint and, where relevant, the version that removes it. `<language>-style.md` lists
this language's specific pragmas.

## No dead code

Remove unused exports, parameters, fields, events, and configuration the moment they
stop being wired up. Commented-out code is dead code with extra steps — the history is
in version control.

## Self-check before you finish

1. Does any function nest three levels deep, or take a fourth positional parameter?
2. Does any open `if`-chain branch on a closed set of values?
3. Does any file own more than one thing, or run past ~150 lines?
4. Does external data enter without being parsed at the edge?
5. Is any checker-silencing pragma present without a named external constraint?
6. Is anything still here that nothing calls?

Any "yes" to 1–3, 5, or 6, or "no" to 4 → fix it before reporting done.
