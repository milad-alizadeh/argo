---
paths:
  - "{{TEST_GLOB}}"
---

# Testing Rules

A test is a claim about behavior that a machine re-checks on every commit. That makes
the suite the only documentation that cannot drift — prose goes stale silently, a test
goes red. These rules exist to keep that property: a suite that passes while the
product is broken is worse than no suite, because it launders the breakage as safety.

Runner: {{TEST_RUNNER}}. End-to-end: {{E2E_RUNNER}}. The rules are about what a test
proves and how it stays honest, so they hold in any language; only the tool names are
this project's.

## Test the behavior, not the implementation

Assert on what a caller can observe through the public surface — the exported
function's return, the rendered output, the HTTP response, the row that landed.

- **Forbidden:** reaching for a private, an internal module path, or a component's
  state to assert on it. If a behavior is only reachable privately, either it's dead
  or the module's public surface is missing it.
- **Forbidden:** asserting that a function *was called*, in place of asserting what
  happened. A call-count assertion on `save` passes when `save` is completely broken.
- The payoff is the whole point of the rule: a refactor that preserves behavior must
  leave the suite green. A suite that reds on every rename is measuring the shape of
  the code, and it will be deleted the first time it's inconvenient.

## Don't mock what you own

A mock of your own module asserts that two units agree, using a fake that can't
disagree. When your own code is hard to reach without mocking it, the coupling is the
finding — fix the seam, don't paper it.

- Mock only what you do not control **and** cannot afford live: a paid third-party
  API, a clock, a randomness source, a network the CI box can't reach.
- Everything you own runs for real, including the database — in a container, on a
  temp file, in memory, whatever the runner supports.
- **Forbidden:** a mock whose return value is copy-pasted from a real response and now
  drifts on its own schedule. Derive fixtures from the real schema, or hit the real thing.

## The critical paths run against real dependencies

At least the paths a user pays you for — sign up, check out, the one workflow that
defines the product — are exercised end-to-end against real services. Mocks hide
precisely the class of bug that ships: the contract mismatch, the migration nobody
ran, the serialization that only fails over the wire.

Unit tests prove your logic. Only an integrated test proves your *system*, and the
system is what breaks in production.

## Address things by what they are, not by how they're decorated

A test finds the thing it acts on through the same surface a real consumer would: a
user-facing UI through its accessible role and label, an API through its documented
contract, a queue through its message schema. Never through an incidental detail —
a CSS class, a DOM position, a column order, a serialization quirk.

- **Forbidden:** selectors that assert styling or structure (`.btn-primary`,
  `div > span:nth-child(2)`). They survive nothing and prove nothing.
- **Forbidden:** a hardcoded identifier for something the system generates — a
  database-derived URL, an auto-increment id, a generated file name. Discover it at test
  time. Identifiers that are themselves a contract (a legal page path, a documented
  webhook route) keep their literals; that's what makes them contracts.

{{QUERY_LADDER}}

This rule pays twice over: addressing a UI the way assistive technology addresses it means
a test that can't find an element is usually reporting a real accessibility defect.

## One concept per test

A test name states one behavior, and the body proves that one. If the name needs an
"and", it is two tests.

- **Forbidden:** a name that describes the mechanics (`test('works')`,
  `test('calls the handler')`). Name the claim: `rejects an expired token`.
- A failure should tell you what broke from the name alone, before you open the file.
  That only holds when the test proves one thing.
- Setup may be long; the assertion block should be short. A tail of unrelated
  assertions is other tests hiding.

## Name the behavior in the domain's words

A test name is a sentence about the domain, readable by someone who will never open the
file — the person who wrote the requirement should recognise their own words in it.

- **Forbidden:** naming the unit under test instead of the behavior (`parseConfig returns
  an object`). Name what the system does: `rejects a config with no source globs`.
- Reach for the vocabulary the glossary or the ticket uses. Where a test's wording and the
  domain's disagree, one of them is wrong and it's worth finding out which.
- A suite whose names read as a list of requirements is the specification. That's the
  property that makes tests documentation rather than scaffolding.

## Tests are isolated and order-independent

Each test builds the state it needs and leaves nothing behind. Any test can run alone,
in any order, in parallel, and still pass.

- **Forbidden:** shared mutable state between tests (a module-level counter, a seeded
  row a later test depends on, a session reused across cases).
- **Forbidden:** a test that passes in the suite and fails alone, or vice versa. That's
  a broken test, not a quirk — a failure elsewhere will be blamed on it for weeks.
- Randomize execution order if the runner supports it, so coupling surfaces
  immediately rather than during an unrelated refactor.

## One scenario, many rows

When the same behavior needs several inputs, write one parameterized case with a table
of rows — not N copy-pasted blocks that drift apart. The table becomes the
specification: adding a case is adding a row, and the reader sees the whole domain of
inputs at once.

Keep the assertion identical across rows. If a row needs different assertions, it's a
different behavior and belongs in its own test.

## Self-check before you finish

1. Does any assertion touch a private, an internal path, or "was called"?
2. Is anything mocked that this repo owns?
3. Is anything addressed by an incidental detail — a class, a position, a generated id?
4. Does any test name contain "and"?
5. Would this test pass if run alone, first, or in parallel?
6. Are there copy-pasted near-identical tests that should be one table?

Any "yes" to 1–4 or 6, or "no" to 5 → fix it before reporting done.
