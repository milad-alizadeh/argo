---
paths:
  - "{{SOURCE_GLOBS}}"
---

# Domain Types

A type is the only place a rule gets stated **once** and checked **everywhere**, by the
compiler, on every call site. The question this file asks of every value: does the type say
what this is, or does the reader have to know? `code-style.md` covers parsing external data
at the edge; this file covers what you parse it *into*.

## A domain value never travels as a bare primitive

An identifier, a money amount, an email, a duration, a URL each has invariants a `string` or
a number does not.

- **Forbidden:** two same-shaped primitives adjacent in a signature. `transfer(from: string,
  to: string)` accepts its arguments in the wrong order silently and forever.
- **Forbidden:** a raw number for a quantity with a unit. Milliseconds and seconds have the
  same type and different meanings.
- **Forbidden:** validating the same string in three places. The check moves into the
  constructor and the call sites stop repeating it.

`<language>-style.md` names how this language makes two same-shaped types incompatible.

**Not every primitive needs a wrapper.** The test is whether a wrong value of the same shape
could be passed without anyone noticing. If not, wrapping it is ceremony, and ceremony
teaches people to skip the rule where it matters.

## Make illegal states unrepresentable

If a combination of fields is impossible, the type should not be able to express it.

- **Forbidden:** two optional fields that are only ever both-present or both-absent. That is
  one optional field holding a pair.
- **Forbidden:** a flag plus a value only meaningful when the flag is set (`isLoaded` beside a
  nullable `data`). That is one union of two states.
- **Forbidden:** a status string next to fields only some statuses use. Model the status as a
  closed set where each case carries exactly its own data.
- **Forbidden:** a boolean pair encoding three states. Three states is an enum.

## The type is the documentation

Prefer moving a sentence into a name or a type: a parameter named `timeoutMs`, a `Result`
rather than a nullable value with a comment about when it is null. A comment that survives
that move is carrying a *why*; keep it.

## One owner per domain type

The type and its constructor live in the module that owns the concept, reached through that
module's public entry (`file-structure.md`).

- **Forbidden:** re-declaring a domain type structurally in a caller.
- **Forbidden:** a type owned by the transport (a database row, an API response) used as the
  domain type. Parse the wire shape into the domain shape at the edge, once.
