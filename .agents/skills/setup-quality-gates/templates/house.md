# House Rules

What no linter checks and a model does not do unprompted. Every cap, escape-hatch ban and
formatting rule is a build failure in {{LINT_CONFIG}}, so none is restated here; when a gate
fires, fix the code or ratchet the exemption where the config keeps it, never inline.

## Code

- **Ground external calls.** Every call into an API you don't own is written against a source
  opened this session: the installed dependency's own declarations, an existing call site, or
  the current docs. If it can't be grounded, say so instead of shipping it.
- **Names are words.** `percentage` not `pct`, `context` not `ctx`, `repository` not `repo`,
  user-visible labels included. Exceptions: an acronym that is the domain's own name (`URL`,
  `ID`) and a name the platform fixes.
- **Branch on a closed set with the exhaustive construct** ({{EXHAUSTIVE_CONSTRUCT}}), and
  reserve chained conditionals for open conditions. When the discriminant only picks a value, a
  lookup keyed by it beats both.
- **Validate at the boundary.** Data from outside is parsed into a known shape at the edge,
  once ({{BOUNDARY_PARSER}}); a cast or a type annotation standing in for a check is a bug
  moved inward.
- **One source of truth.** A literal in two call sites is extracted before the second paste.
  A new variant of an existing kind is one new file plus one registration line.
- **Group by domain, never by kind.** `checkout/`, not `utils/` or `types/`; a helper is born
  beside its only caller and hoists on the third. Callers import a module's public entry
  ({{PUBLIC_ENTRY}}), never a leaf.
- **Tokens by name.** In UI code every colour, spacing, radius, duration and type size is a
  named token, never an inline literal or hex.
- **Only what's needed.** No config knob, layer or hook for a need that doesn't exist yet.
  Delete dead code on sight.

## Comments

An ordinary comment is one line, whatever the marker. {{DOC_SURFACES}} Keep a fact a future
edit could falsify (a measured number, a framework behaviour, a defence of code that looks
wrong) at whatever length it needs. Cut an argument, a rejected alternative, a WHAT-restatement,
a tombstone, or the story of how a constraint got here; a bare ticket number on the constraint
line is enough.

## Tests

- **Assert what happened, never that a function was called.** A refactor that preserves
  behaviour leaves the suite green.
- **Mock only what you don't control and can't afford live**: a paid API, a clock, a network
  CI can't reach. Everything you own runs for real, the database included.
- **Name the claim in the domain's words** (`rejects an expired token`), one behaviour per
  test; the same behaviour over several inputs is one parameterised case.
- **Each test builds its own state** and passes alone, in any order, in parallel.
- **Find a thing by what it is**: a control by its accessible role and label, an API by its
  contract, never a CSS class, a position or a generated id.
