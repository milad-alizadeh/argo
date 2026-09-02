#!/usr/bin/env node
// Tests for `record-figures.sh`, the harness that re-records ADR-0028's seconds-side figures.
// Run via `bun run test:hooks`, so they hold on Linux where no Swift toolchain exists.
//
// Its own file rather than more cases in `swift-tooling.test.mjs`: that one sat on the 150-line
// ceiling already (#998), and this script's subject is different — not "did the tool run" but
// "did the measurement happen at all", which is the failure an env-gated suite has.
//
// EVERY NUMBER BELOW IS STUB OUTPUT AND NOT A MEASUREMENT. They are chosen so the least, the two
// arms and the fold are each distinguishable in the summary — nothing here was timed.
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { ARGV_LOG, BARE, run, STRICT, scratch } from './swift-tooling.harness.mjs'

const RECORD = 'apps/macOS/scripts/record-figures.sh'
const bin = path.join(scratch, 'figure-bin')
const ARMS = path.join(scratch, 'arms.log')
const COUNT = path.join(scratch, 'round')
mkdirSync(bin, { recursive: true })
// `uname` says Darwin so these run on the Linux job too — the script's own platform guard has
// its own cases below.
writeFileSync(path.join(bin, 'uname'), '#!/bin/sh\nprintf Darwin\n')
chmodSync(path.join(bin, 'uname'), 0o755)
const ON_DARWIN = { pathValue: `${bin}:/usr/bin:/bin` }

// A `swift` that answers a `test` invocation with whatever FIGURE lines the case wants, and
// records which arm it was called as — the interleaving is a claim, so something has to see it.
//
// It exits 7 when `ARGO_RECORD_FIGURES` is missing, which is the suite's own gate: every passing
// case below is also the proof that the script sets it.
function swiftPrinting(lines, exitCode = 0) {
  rmSync(ARMS, { force: true })
  rmSync(`${COUNT}.debug`, { force: true })
  rmSync(`${COUNT}.release`, { force: true })
  writeFileSync(
    path.join(bin, 'swift'),
    `#!/bin/sh
printf '%s\\n' "$@" >> '${ARGV_LOG}'
[ "$1" = test ] || exit 0
[ -n "\${ARGO_RECORD_FIGURES:-}" ] || exit 7
arm=debug
for one in "$@"; do if [ "$one" = release ]; then arm=release; fi; done
printf '%s\\n' "$arm" >> '${ARMS}'
round=$(cat '${COUNT}'."$arm" 2>/dev/null || echo 0)
round=$((round + 1))
printf %s "$round" > '${COUNT}'."$arm"
${lines}
exit ${exitCode}
`,
  )
  chmodSync(path.join(bin, 'swift'), 0o755)
}

// The seven the script names in FIGURES: a run short of one of them is a failure, so a stub that
// wants to reach the summary has to answer with all seven.
const SEVEN =
  'feed-measure-pass-cold session-reading-warm band-paint-cold band-paint-warm' +
  ' sixty-scrolled-frames thirty-seam-frames markdown-band-cold'

// Two rounds of two arms, four distinct readings, so the least of each arm is not the first one
// the run saw. 3.00 over 2.00 is a fold of 1.50. `$skip` is the slug a case wants dropped, and
// `$only` the arm to drop it from — an empty arm drops it from both.
const READINGS = `case "$arm/$round" in
  debug/1) fresh=9.00 ;;
  debug/2) fresh=3.00 ;;
  release/1) fresh=6.00 ;;
  release/2) fresh=2.00 ;;
esac
for slug in ${SEVEN}; do
  if [ "$slug" = "$skip" ] && { [ -z "$only" ] || [ "$only" = "$arm" ]; }; then continue; fi
  echo "FIGURE $slug fresh=\${fresh}ms recorded-debug=1.00ms recorded-release=1.00ms on=$ON fold=$FOLD"
done`
const twoRounds = { ARGO_FIGURE_ROUNDS: '2' }
const dropping = (skip = '', only = '') => `skip=${skip}\nonly=${only}\n`
const loaded = (extra = '', skip, only) =>
  dropping(skip, only) +
  READINGS.replace('$ON', 'loaded-laptop').replace('$FOLD', 'unbound') +
  extra

check('record-figures.sh skips where Swift cannot run', () => {
  const result = run(RECORD, BARE)
  assert.equal(result.status, 0, `expected a skip, got: ${result.output}`)
  assert.match(result.output, /skipping/)
})

check('record-figures.sh fails there instead under ARGO_REQUIRE_SWIFT_TOOLS', () => {
  const result = run(RECORD, { ...BARE, env: STRICT })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /ARGO_REQUIRE_SWIFT_TOOLS is set/)
})

check('record-figures.sh builds both configurations before it times anything', () => {
  swiftPrinting(loaded())
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 0, result.output)
  const builds = result.argv.indexOf('build')
  assert.ok(builds >= 0 && builds < result.argv.indexOf('test'), result.argv.join(' '))
  assert.equal(result.argv.filter((arg) => arg === '--build-tests').length, 2)
})

// The three flags the run is worth nothing without: `--filter`, or every other suite in the
// package lands on the measurement; `-c release`, or both arms are the same arm; and `-Xswiftc
// -DDEBUG`, without which the test target does not COMPILE optimised at all (#991). One release
// build plus one release round per round, so three of each at two rounds.
check('record-figures.sh filters to the harness and spells the release arm in full', () => {
  swiftPrinting(loaded())
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 0, result.output)
  const count = (arg) => result.argv.filter((one) => one === arg).length
  assert.equal(count('--filter'), 4, result.argv.join(' '))
  assert.equal(count('MinimapFigureRecording'), 4)
  assert.equal(count('release'), 3)
  assert.equal(count('-DDEBUG'), 3)
})

check('record-figures.sh interleaves the arms and takes the least of each', () => {
  swiftPrinting(loaded())
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 0, result.output)
  assert.equal(
    readFileSync(ARMS, 'utf8').trim().split('\n').join(','),
    'debug,release,debug,release',
  )
  assert.match(result.output, /band-paint-cold\s+3\.00\s+2\.00\s+1\.50/)
})

check('record-figures.sh says nothing binds while the figures are a loaded laptop’s', () => {
  swiftPrinting(loaded())
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /no fold binds yet \(#1024\)/)
  assert.doesNotMatch(result.output, /within 3x/)
})

check('record-figures.sh fails when the harness printed no figure at all', () => {
  swiftPrinting('')
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /not one figure printed/)
})

// Both halves of the completeness claim. The second is the one a set built from what ARRIVED
// cannot make: a case that fell over in both arms prints nothing anywhere, so only the named list
// in the script can miss it.
for (const [where, only] of [
  ['one arm', 'release'],
  ['every arm, so nothing printed it at all', ''],
]) {
  check(`record-figures.sh fails when a figure is missing from ${where}`, () => {
    swiftPrinting(loaded('', 'thirty-seam-frames', only))
    const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /thirty-seam-frames read 0 times in (debug|release)/)
  })
}

check('record-figures.sh fails on a figure it was never told to expect', () => {
  swiftPrinting(`${loaded()}\necho "FIGURE seam fresh=1.00ms on=loaded-laptop fold=unbound"`)
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /seam is not a figure this run expects/)
})

// A reading of zero is a field this parser did not find, never a fast path — and it is the
// denominator of the fold two lines further on.
check('record-figures.sh refuses a reading of zero rather than dividing by it', () => {
  swiftPrinting(loaded().replace('release/2) fresh=2.00', 'release/2) fresh=0.00'))
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /read 0 ms in release/)
})

for (const rounds of ['nine', '0']) {
  check(`record-figures.sh refuses ARGO_FIGURE_ROUNDS=${rounds} before it builds anything`, () => {
    swiftPrinting(loaded())
    const result = run(RECORD, { ...ON_DARWIN, env: { ARGO_FIGURE_ROUNDS: rounds } })
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /is a round count/)
    assert.deepEqual(result.argv, [])
  })
}

check('record-figures.sh surfaces a non-zero swift exit', () => {
  swiftPrinting(loaded(), 3)
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 3, result.output)
  assert.match(result.output, /swift exited 3 in round 1 \(debug\)/)
})

// The other side of the binding switch: once `PerfBudgets.figureMachine` is a quiet runner's, the
// suite prints a fold and this script holds the fresh one to 3x either way.
const quiet = (fold) => dropping() + READINGS.replace('$ON', 'quiet-runner').replace('$FOLD', fold)

check('record-figures.sh checks the fold once the figures are a quiet runner’s', () => {
  swiftPrinting(quiet('1.40x'))
  const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /every fold within 3x/)
})

// The recorded fold is named in each message, so neither case can pass on the other's failure.
for (const [what, fold] of [
  ['above', '0.10x'],
  ['below', '9.00x'],
]) {
  check(`record-figures.sh fails when the fresh fold is ${what} 3x of the recorded one`, () => {
    swiftPrinting(quiet(fold))
    const result = run(RECORD, { ...ON_DARWIN, env: twoRounds })
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, new RegExp(`folds 1\\.50 against a recorded ${fold}`))
  })
}

rmSync(scratch, { recursive: true, force: true })

report('record-figures')
