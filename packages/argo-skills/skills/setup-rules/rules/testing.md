---
paths:
  - "{{TEST_GLOB}}"
---

# Testing Rules

A test is a claim about behaviour that a machine re-checks on every commit, which makes the
suite the only documentation that cannot drift. A suite that passes while the product is
broken launders the breakage as safety.

Runner: {{TEST_RUNNER}}. End-to-end: {{E2E_RUNNER}}. A committed focused or skipped test is a
lint error, not a rule here.

## Test the behaviour, not the implementation

Assert on what a caller can observe through the public surface. **Forbidden:** reaching for a
private or a component's internal state, and asserting that a function *was called* in place
of asserting what happened. A refactor that preserves behaviour must leave the suite green.

## Don't mock what you own

A mock of your own module asserts that two units agree, using a fake that can't disagree.
Mock only what you do not control **and** cannot afford live: a paid API, a clock, a network
the CI box can't reach. Everything you own runs for real, the database included. A fixture
copy-pasted from a real response drifts on its own schedule; derive it from the real schema.

## The critical paths run against real dependencies

The workflows a user pays for are exercised end-to-end against real services. Unit tests
prove your logic; only an integrated test proves the system, and the system is what breaks.

## Address things by what they are

Find the thing a test acts on through the surface a real consumer uses: a UI by its
accessible role and label, an API by its contract, a queue by its schema. Never through an
incidental detail (a CSS class, a DOM position, a column order), and never by a hardcoded
identifier for something the system generates.

{{QUERY_LADDER}}

## One concept per test, named in the domain's words

A test name states one behaviour and the body proves that one. If the name needs an "and", it
is two tests. Name the claim (`rejects an expired token`), never the unit under test or the
mechanics (`works`, `calls the handler`). A suite whose names read as requirements is the
specification.

## Tests are isolated and order-independent

Each test builds the state it needs and leaves nothing behind. **Forbidden:** shared mutable
state between tests, and a test that passes in the suite and fails alone. Randomise execution
order if the runner supports it.

## One scenario, many rows

The same behaviour over several inputs is one parameterised case with a table of rows, with
the assertion identical across rows. A row that needs a different assertion is a different
behaviour and its own test.
