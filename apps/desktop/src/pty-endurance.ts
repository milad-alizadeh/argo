// The 600-cycle descriptor endurance check from
// [#1749](https://github.com/milad-alizadeh/argo/issues/1749). A PTY leak does not announce
// itself: the app works all morning and then stops being able to open anything, because every
// Session that ended left a descriptor behind. Six hundred cycles is enough for a one-per-cycle
// leak to be unmistakable against ordinary noise, and cheap enough to run on every packaged build.
//
// The measurement is the count of open file descriptors held by THIS process, before and after.
// macOS has no /proc, so `lsof -p` is the reading available, and it is taken twice with the same
// instrument rather than compared against an absolute number.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PtySession } from './pty-session'

const execFileAsync = promisify(execFile)

export const CYCLES = 600
// Anything a PTY leaks, it leaks once per cycle, so a real leak lands near 600 and not near 8.
// The allowance is for the descriptors the runtime itself opens while this runs.
export const ALLOWED_GROWTH = 8
const CYCLE_TIMEOUT_MS = 15_000
const SETTLE_MS = 500

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function openDescriptorCount(): Promise<number> {
  // lsof exits 1 when some descriptor cannot be inspected, having still listed the rest, so the
  // exit code is not the signal here — the output is.
  const { stdout } = await execFileAsync('/usr/sbin/lsof', ['-p', String(process.pid)]).catch(
    (error: { stdout?: string }) => ({ stdout: error.stdout ?? '' }),
  )
  const lines = stdout.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length === 0) throw new Error('lsof reported nothing, so no descriptor count was taken')
  return lines.length - 1 // the header
}

async function oneCycle(cwd: string): Promise<void> {
  const session = new PtySession('/bin/sh', ['-c', 'exit 0'], cwd)
  const deadline = Date.now() + CYCLE_TIMEOUT_MS
  while (session.exitCount === 0 && Date.now() < deadline) await sleep(1)
  if (session.exitCount === 0) throw new Error('a cycle never exited')
}

export async function descriptorsStayFlat(cwd: string): Promise<Record<string, number>> {
  // A first PTY before the baseline, so node-pty's own one-off descriptors are inside it rather
  // than counted as growth.
  await oneCycle(cwd)
  await sleep(SETTLE_MS)
  const before = await openDescriptorCount()

  for (let cycle = 0; cycle < CYCLES; cycle += 1) await oneCycle(cwd)

  await sleep(SETTLE_MS)
  const after = await openDescriptorCount()
  const growth = after - before
  if (growth > ALLOWED_GROWTH)
    throw new Error(
      `${CYCLES} spawn/exit cycles grew the descriptor count by ${growth} ` +
        `(${before} → ${after}), over the ${ALLOWED_GROWTH} allowed. That is a PTY leak.`,
    )
  return { cycles: CYCLES, before, after, growth }
}
