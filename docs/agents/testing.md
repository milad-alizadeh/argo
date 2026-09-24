# Testing rules

Read this when writing tests or fixing a bug.

- Assert observable behavior with independent test state.
- A regression test must fail on the original bug and pass with the fix.
- Test outside formats against recorded data from the real producer.
