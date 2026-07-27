---
paths:
  - "{{SOURCE_GLOBS}}"
---

# Engineering Principles

Write code that's easy to change **without a chain reaction**. These are rules,
not aspirations — stated as forbidden-lists because you can pattern-match a
violation, not an abstract virtue. Language-agnostic: they bind every language
in the repo equally.

## One source of truth (DRY + SSOT)

- Every value, rule, type, or decision lives in exactly ONE place — define once,
  import it.
- **Forbidden:** the same literal (a model id, URL, threshold, magic string)
  copy-pasted into two+ call sites. About to paste it a second time? Extract first.
- **Forbidden:** an `old → new` migration / normalizer map. Validate-and-default
  at the point of use instead.

## Depend on the abstraction, not the concretion (DIP)

- A caller asks WHAT it needs ("give me a name", "embed this"), never HOW (which
  model, host, transport). The *how* lives behind one interface, resolved at use-time.
- **Forbidden:** a call site naming a concrete backend — a specific model id, a
  hostname, a vendor. Push it behind the interface.
- Test: could you swap the implementation without editing any caller? If not, the
  abstraction is wrong.

## Add by adding, not editing (Open/Closed)

- A new variant of an existing *kind* of thing (a provider, role, tool, intent) =
  ONE new file + ONE registration line. Nothing else moves.
- **Forbidden:** an `if (type === 'newThing')` branch threaded through existing
  consumers to bolt on a variant. Use the registry/interface the family already has.

## One unit, one job (SRP)

- A file/function/module does ONE thing. Orchestration is separate from the work
  it orchestrates; UI separate from logic separate from data access.
- If you can't name what a file does in one sentence without "and", split it.

## Entry points dispatch, they don't decide

An entry point — an HTTP route, an IPC handler, a CLI command, an event listener, a
button's `onClick` — parses its input, calls ONE named unit that does the work, and
maps the result to a response. Nothing else.

- **Forbidden:** business rules, branching on domain state, or a query inside a
  handler body. Those belong in a unit you can call from a test without constructing
  a request.
- Test: could you exercise this behavior without the transport? If reaching it needs
  a fake request, a mock event, or a rendered component, the logic is in the wrong place.
- A handler that grows past a screen is holding something that belongs elsewhere.

## Compute where the data lives

Work runs in the tier that owns the authoritative data; every other tier transports
state rather than authoring it.

- **Forbidden:** the same business rule implemented in two tiers (client re-deriving
  what the server already shaped, a server re-checking a constraint the database
  enforces).
- **Forbidden:** a round-trip that exists only to format something.
- Move outward — to the client, the edge, the device — only for a stated reason:
  latency, privacy, or offline autonomy. Name the reason where you opt out.

## Ground external calls, don't recall them

Every call into an API you don't own — a library, a service, a CLI, a schema — is
written against a **source consulted in this session**, never from memory. Model
recall of an API is a snapshot that was already stale when training ended, and the
failure mode is a confident, plausible, non-existent signature.

- Before writing the call: read the installed dependency's own source or type
  declarations, grep an existing call site in this repo, fetch the current docs, or query
  the documentation MCP. Any one of those. Zero is a guess.
- The version that matters is **the one this project has installed**, not the latest release.
- If a call can't be grounded, say so in the report instead of shipping it silently.

## Simple, and only what's needed (KISS + YAGNI)

- Prefer the boring, obvious solution: the fewest moving parts that solve the
  ACTUAL task, not an imagined future one.
- **Forbidden:** speculative generality (config knobs, abstraction layers, hooks)
  for a need that doesn't exist yet. Delete dead/unused code on sight.

## Self-check before you finish

1. Is any value defined in more than one place?
2. Does any caller name a concrete backend / model / host?
3. Would adding the *next* variant force edits to existing files?
4. Does any entry point decide something instead of dispatching?
5. Is any external call written from recall rather than a source you opened?
6. Can each file's job be said in one sentence?

Any "yes" to 1–5, or "no" to 6 → fix it before reporting done.
