// The test harness every `scripts/*.test.mjs` runs its cases through, shared rather than copied.
//
// Ten copies meant ten places a counting bug could differ, in the tests that gate agent edits,
// hook projection and module boundaries. Module state is per process and each suite is its own
// `node` invocation, so one counter here is one counter per suite.

let failures = 0

export function check(name, fn) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures += 1
    console.error(`  FAIL ${name}\n       ${err.message}`)
  }
}

// Exits 1 on any failure, never a code of its own: `test:hooks` chains the suites with `&&`, so
// only zero-vs-non-zero is read. Which arm broke is carried by the FAIL lines above, and by
// whatever a case puts in its assertion message — that is where a suite says which half it lost.
export function report(suite) {
  if (failures) {
    console.error(`\n${suite}: ${failures} check(s) failed`)
    process.exit(1)
  }
  console.log(`\n${suite}: all checks passed`)
}
