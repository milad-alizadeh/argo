---
paths:
  - "{{TEST_GLOB}}"
---

# Testing Rules

A test is a claim about behavior that a machine re-checks on every commit. That makes
the suite the only documentation that cannot drift — prose goes stale silently, a test
goes red. These rules exist to keep that property: a suite that passes while the
product is broken is worse than no suite, because it launders the breakage as safety.

Runner: `{{TEST_RUNNER}}`. End-to-end: `{{E2E_RUNNER}}`.

## Test the behavior, not the implementation

Assert on what a caller can observe through the public surface — the exported
function's return, the rendered output, the HTTP response, the row that landed.

- **Forbidden:** reaching for a private, an internal module path, or a component's
  state to assert on it. If a behavior is only reachable privately, either it's dead
  or the module's public surface is missing it.
- **Forbidden:** asserting that a function *was called*, in place of asserting what
  happened. `expect(save).toHaveBeenCalled()` passes when `save` is broken.
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

## Locate by structure, not by decoration

Query the accessibility tree, in this order: `getByRole` → `getByLabelText` →
`getByText`. `getByTestId` is the last resort, and each use is a small admission that
the element isn't reachable the way a screen reader reaches it.

- **Forbidden:** CSS-class and DOM-shape selectors (`.btn-primary`, `div > span:nth-child(2)`).
  They assert styling and survive nothing.
- **Forbidden:** a hardcoded URL for content that comes from a database. Discover
  dynamic routes at test time (the sitemap, a fixture query, the router manifest).
  Static paths that are themselves a contract — legal, marketing, a documented
  webhook — keep their literals; that's what they're for.

This rule pays twice: the query ladder is the same tree assistive technology walks, so
a test that can't find the element is usually reporting a real accessibility defect.

## One concept per test

A test name states one behavior, and the body proves that one. If the name needs an
"and", it is two tests.

- **Forbidden:** a name that describes the mechanics (`test('works')`,
  `test('calls the handler')`). Name the claim: `rejects an expired token`.
- A failure should tell you what broke from the name alone, before you open the file.
  That only holds when the test proves one thing.
- Setup may be long; the assertion block should be short. A tail of unrelated
  assertions is other tests hiding.

## Tests are isolated and order-independent

Each test builds the state it needs and leaves nothing behind. Any test can run alone,
in any order, in parallel, and still pass.

- **Forbidden:** shared mutable state between tests (a module-level counter, a seeded
  row a later test depends on, a session reused across cases).
- **Forbidden:** a test that passes in the suite and fails alone, or vice versa. That's
  a broken test, not a quirk — a failure elsewhere will be blamed on it for weeks.
- Randomize execution order if `{{TEST_RUNNER}}` supports it, so coupling surfaces
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
3. Is any element found by class, test-id, or DOM position where a role would work?
4. Does any test name contain "and"?
5. Would this test pass if run alone, first, or in parallel?
6. Are there copy-pasted near-identical tests that should be one table?

Any "yes" to 1–4 or 6, or "no" to 5 → fix it before reporting done.
