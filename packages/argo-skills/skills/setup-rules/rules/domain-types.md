---
paths:
  - "{{SOURCE_GLOBS}}"
---

# Domain Types

A type is the only place a rule gets stated **once** and checked **everywhere**. A rule
written in prose is re-read by whoever remembers it; a rule written in a type is re-checked
on every call site, forever, by the compiler. So the question this file asks of every value
is: does the type say what this is, or does the reader have to know?

`code-style.md` covers parsing external data at the edge. This file covers what you parse it
*into*, and it is the same discipline one step earlier: the shape you validate against is the
shape the rest of the program relies on, so that shape has to carry the meaning.

## A domain value never travels as a bare primitive

An identifier, a money amount, an email, a duration, a URL, a country code — each has
invariants a `string` or a number does not.

- **Forbidden:** two same-shaped primitives adjacent in a signature. `transfer(from: string,
  to: string)` accepts its arguments in the wrong order silently and forever; `transfer(from:
  AccountId, to: AccountId)` still does, but `charge(user: UserId, order: OrderId)` cannot.
  Wherever a swap is possible and would be silent, the types are the fix.
- **Forbidden:** a raw number for a quantity with a unit. Milliseconds and seconds have the
  same type and different meanings, and that gap is where the bug lives.
- **Forbidden:** validating the same string in three places. If it needs checking, it needs a
  type; the check moves into the constructor and the call sites stop repeating it.

`<language>-style.md` names how this language makes two same-shaped types incompatible —
some spell it as a wrapper, some as a branded alias, some as a distinct declared type.

**Not every primitive needs a wrapper.** A value with no invariant and no confusable
neighbour is fine as it is: a log message is a string. The test is whether a wrong value of
the same shape could be passed without anyone noticing. If not, wrapping it is ceremony, and
ceremony teaches people to skip the rule where it matters.

## Make illegal states unrepresentable

If a combination of fields is impossible, the type should not be able to express it. Every
impossible-but-representable state is a branch someone eventually has to write, and a test
someone eventually has to fail.

- **Forbidden:** two optional fields that are only ever both-present or both-absent. That is
  one optional field holding a pair.
- **Forbidden:** a flag plus a value that is only meaningful when the flag is set —
  `isLoaded` beside a nullable `data`. That is one union of two states, and it removes the
  fourth case nobody handled.
- **Forbidden:** a status string next to fields that only some statuses use. Model the status
  as a closed set where each case carries exactly its own data; `code-style.md`'s exhaustive
  branching then makes a new case a compile error rather than a silent fallthrough.
- **Forbidden:** a boolean pair encoding three states. Three states is an enum.

## The type is the documentation

A comment restating what a signature already says is drift waiting to happen
(`comments.md`). Prefer moving the sentence into a name or a type: a parameter named
`timeoutMs`, a return type of `Result` rather than a nullable value with a comment about
when it is null. When the comment survives that move, it is carrying a *why* — keep it.

## One owner per domain type

The type and its constructor live in the module that owns the concept, and that module's
public entry (`file-structure.md`) is how everything else gets them. A second definition of
the same concept in another module is the duplication gate's problem tomorrow and a silent
divergence today: two `User` shapes that agree now will not agree after the next change.

- **Forbidden:** re-declaring a domain type structurally in a caller because importing it
  felt heavy.
- **Forbidden:** a type owned by the transport — a database row shape or an API response
  shape used as the domain type. Those change for reasons that have nothing to do with the
  domain, and every consumer inherits the churn. Parse the wire shape into the domain shape
  at the edge, once.

## Self-check before you finish

1. Could any two arguments in this signature be swapped without a compile error?
2. Does any type in this change permit a combination that cannot happen?
3. Is any value validated in more than one place instead of at its constructor?
4. Does any comment state something the type could state?
5. Is any wire or row shape being used as a domain type?
