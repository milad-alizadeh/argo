// The test harness every `scripts/*.test.mjs` runs its cases through, shared rather than copied.
//
// Module state is per process and each suite is its own `node` invocation, so one counter here is
// one counter per suite.

let passes = 0
let failures = 0

export function check(name, fn) {
  try {
    fn()
    passes += 1
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures += 1
    console.error(`  FAIL ${name}\n       ${err.message}`)
  }
}

// Exits 1 on any failure, never a code of its own: `run-suites.mjs` reads only zero-vs-non-zero.
// Which arm broke is carried by the FAIL lines above, and by whatever a case puts in its
// assertion message — that is where a suite says which half it lost. The runner buffers both
// streams and prints them whole for a failing suite, so nothing written here is lost to the pool.
//
// Zero cases is a failure, not a pass. Several suites build their cases by iterating a literal
// array; empty that array, or filter it on a toolchain that is absent, and a suite that checked
// nothing reports success while the runner counts it green. `swift-test.sh` refuses a run
// reporting 0 tests for this reason, and the harness is held to its own rule. The runner holds
// the same rule from outside: a suite exiting 0 without the line below is a failure there too.
export function report(suite) {
  if (failures) {
    console.error(`\n${suite}: ${failures} check(s) failed`)
    process.exit(1)
  }
  if (passes === 0) {
    console.error(`\n${suite}: ran no checks at all — a suite that checks nothing is not a pass`)
    process.exit(1)
  }
  console.log(`\n${suite}: all ${passes} checks passed`)
}
