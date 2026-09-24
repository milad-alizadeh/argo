# Testing rules

Read this when writing tests or fixing a bug. The domain model supplies test names.

- Assert observable outcomes, not that a function was called.
- For a bounded XState machine, cover paths from `xstate/graph` and assert their
  outcomes. Add focused tests for behavior those paths cannot express.
- Mock only a dependency you do not control and cannot afford to use live, such
  as a paid API, clock, or unreachable network.
- Name one behavior per test in the domain's words. Use a parameterised case
  for several inputs to that same behavior.
- Each test builds its own state and passes alone, in any order, in parallel.
- Prove a regression test against the original bug: red on the symptom, green
  with the fix, red with only the fix reverted, then green when restored. Use
  `git apply -R` on a patch of the fix; the stash stack is shared across worktrees.
- Before fixing a bug, search closed issues for the symptom. If it recurs,
  link the issues, identify the invariant every cause broke, and test it across
  every path that reaches the symptom.
- Test outside formats against recorded data from the real producer. A
  handwritten fixture covers only shapes already known.
