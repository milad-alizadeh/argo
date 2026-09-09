// The acceptance boundary for a Session's process host, carried over from
// [#1749](https://github.com/milad-alizadeh/argo/issues/1749) and now run against `node-pty`
// (#1791). It is host-independent on purpose: it says what a PTY must do, not who provides it.
//
// It runs INSIDE the packaged app, because that is the only place the properties are true or
// false. A PTY that works under `bun test` says nothing about one behind a hardened runtime, an
// asar and a code signature.
import { PtySession } from './pty-session'

const CASE_TIMEOUT_MS = 15_000
const SETTLE_MS = 300
const SHELL = '/bin/sh'
const CTRL_C = '\x03'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// A marker the shell will not print while echoing the command that produces it: the command
// writes the two halves separately, so only the OUTPUT ever holds the whole string.
function marker(name: string): { command: string; needle: string } {
  return { command: `printf '%s%s\\n' ARGO ${name}`, needle: `ARGO${name}` }
}

export async function startsAndSaysSomething(cwd: string): Promise<void> {
  const session = new PtySession(SHELL, [], cwd)
  try {
    if (!(session.child.pid > 0)) throw new Error(`spawn returned pid ${session.child.pid}`)
    const { command, needle } = marker('START')
    session.write(`${command}\n`)
    await session.waitFor(needle, CASE_TIMEOUT_MS)
  } finally {
    session.kill()
  }
}

// Input has to reach the shell as terminal input, not as a pipe write: a pipe would still run the
// command, so the proof is the ECHO — the tty putting the typed characters back on the screen.
export async function echoesWhatIsTyped(cwd: string): Promise<void> {
  const session = new PtySession(SHELL, [], cwd)
  try {
    session.write('echo ARGO-TYPED')
    await session.waitFor('echo ARGO-TYPED', CASE_TIMEOUT_MS)
    session.write('\n')
    await session.waitFor('ARGO-TYPED\r\n', CASE_TIMEOUT_MS)
  } finally {
    session.kill()
  }
}

// The window size has to reach the kernel's terminal, not just node-pty's own state, so the check
// asks the shell what IT thinks the size is.
export async function resizeReachesTheShell(cwd: string): Promise<void> {
  const session = new PtySession(SHELL, [], cwd)
  try {
    session.resize(100, 30)
    await sleep(SETTLE_MS)
    session.write('stty size\n')
    await session.waitFor('30 100', CASE_TIMEOUT_MS)
  } finally {
    session.kill()
  }
}

// Ctrl-C is a byte on the wire that the line discipline turns into SIGINT for the foreground
// process group. Nothing about that works if the pty was really a pipe.
export async function interruptStopsTheForegroundJob(cwd: string): Promise<void> {
  const session = new PtySession(SHELL, [], cwd)
  try {
    session.write('sleep 30\n')
    await sleep(SETTLE_MS)
    session.write(CTRL_C)
    const { command, needle } = marker('AFTERINT')
    session.write(`${command}\n`)
    await session.waitFor(needle, CASE_TIMEOUT_MS)
  } finally {
    session.kill()
  }
}

// Exactly once. A second onExit would double every Session teardown in the cockpit, and a missing
// one would leave a Session that never ends.
export async function exitFiresExactlyOnce(cwd: string): Promise<void> {
  const session = new PtySession(SHELL, ['-c', 'exit 0'], cwd)
  const deadline = Date.now() + CASE_TIMEOUT_MS
  while (session.exitCount === 0 && Date.now() < deadline) await sleep(20)
  if (session.exitCount === 0) throw new Error('onExit never fired')
  await sleep(SETTLE_MS)
  if (session.exitCount !== 1) throw new Error(`onExit fired ${session.exitCount} times`)
}

// Killing the PTY has to take the process with it. A survivor is an orphan holding a descriptor
// and, in the cockpit, a Session that reads as ended while its CLI is still running.
export async function killLeavesNoOrphan(cwd: string): Promise<void> {
  const session = new PtySession(SHELL, ['-c', 'sleep 30'], cwd)
  const { pid } = session.child
  await sleep(SETTLE_MS)
  session.kill()
  const deadline = Date.now() + CASE_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await sleep(50)
  }
  throw new Error(`pid ${pid} was still alive ${CASE_TIMEOUT_MS}ms after kill()`)
}

export const BEHAVIOUR_CASES = {
  start: startsAndSaysSomething,
  input: echoesWhatIsTyped,
  resize: resizeReachesTheShell,
  interrupt: interruptStopsTheForegroundJob,
  'exit-once': exitFiresExactlyOnce,
  'crash-cleanup': killLeavesNoOrphan,
}
