---
paths:
  - "apps/macOS/**/Tests/**/*.swift"
  - "apps/macOS/ArgoE2ETests/**/*.swift"
  - "scripts/*.test.mjs"
---

# Testing Rules

A test is a claim about behaviour that a machine re-checks on every commit, which makes the
suite the only documentation that cannot drift. A suite that passes while the product is
broken launders the breakage as safety.

Three runners, and what each can prove:

- **swift-testing** per package (`sh apps/macOS/scripts/swift-test.sh`, in `bun run test`).
  Builds a projection and asserts on it; **cannot click**.
- **XCUITest** (`sh apps/macOS/scripts/e2e-test.sh`), a **local** gate that launches Argo and
  drives it. Run it when you touch a surface only reachable by clicking, and launch onto a
  `--specimen`, never the machine's own registry.
- **plain node** for the guardrail hooks (`scripts/*.test.mjs`, `bun run test:hooks`).

## Test the behaviour, not the implementation

Assert on what a caller can observe through the public surface. **Forbidden:** reaching for a
private or a component's internal state, and asserting that a function *was called* in place
of asserting what happened. A refactor that preserves behaviour must leave the suite green.

## Don't mock what you own

A mock of your own module asserts that two units agree, using a fake that can't disagree.
Mock only what you do not control **and** cannot afford live: a paid API, a clock, a network
the CI box can't reach. A fixture copy-pasted from a real response drifts on its own schedule;
derive it from the real schema.

## Address things by what they are

Find the thing a test acts on through the surface a real consumer uses: a control by its
accessibility role and label, an API by its contract. Never through an incidental detail, and
never by a hardcoded identifier for something the system generates.

## One concept per test, named in the domain's words

A test name states one behaviour and the body proves that one. If the name needs an "and", it
is two tests. Name the claim (`rejects an expired token`), never the unit under test or the
mechanics (`works`, `calls the handler`). A suite whose names read as requirements is the
specification.

## Tests are isolated and order-independent

Each test builds the state it needs and leaves nothing behind. **Forbidden:** shared mutable
state between tests, and a test that passes in the suite and fails alone.

## One scenario, many rows

The same behaviour over several inputs is one parameterised case with a table of rows, with
the assertion identical across rows. A row that needs a different assertion is a different
behaviour and its own test.
