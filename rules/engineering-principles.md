# Engineering Principles

Write code that is easy to change **without a chain reaction**. Stated as forbidden-lists
because a violation can be pattern-matched and a virtue cannot. Every language in the repo.

## One source of truth

- Every value, rule, type or decision lives in exactly ONE place. Define once, import it.
- **Forbidden:** the same literal (a model id, URL, threshold, magic string) in two call sites.
  About to paste it a second time? Extract first.
- **Forbidden:** an `old → new` migration or normaliser map. Validate-and-default at the point
  of use instead.

## Depend on the abstraction, not the concretion

- A caller asks WHAT it needs ("give me a name"), never HOW (which model, host, transport).
- **Forbidden:** a call site naming a concrete backend. Push it behind the interface.
- Test: could you swap the implementation without editing any caller?

## Add by adding, not editing

- A new variant of an existing *kind* of thing (a provider, role, tool) is ONE new file plus
  ONE registration line. Nothing else moves.
- **Forbidden:** an `if type == newThing` branch threaded through existing consumers.

## One unit, one job

- A file, function or module does ONE thing. Orchestration is separate from the work it
  orchestrates; UI from logic from data access.
- If you cannot name what a file does in one sentence without "and", split it.
- An entry point (a CLI command, an event listener, a button action) parses its input, calls
  ONE named unit, and maps the result. **Forbidden:** business rules or branching on domain
  state inside the handler. Test: could you exercise this behaviour without the transport?

## Ground external calls, don't recall them

Every call into an API you don't own is written against a **source consulted in this session**:
the installed dependency's own source or declarations, an existing call site in this repo, or
the current docs. Model recall of an API is a snapshot that was stale when training ended.

- The version that matters is **the one this project has installed**.
- If a call can't be grounded, say so in the report instead of shipping it silently.

## Simple, and only what's needed

- The fewest moving parts that solve the ACTUAL task, not an imagined future one.
- **Forbidden:** speculative generality (config knobs, abstraction layers, hooks) for a need
  that doesn't exist yet. Delete dead code on sight.
