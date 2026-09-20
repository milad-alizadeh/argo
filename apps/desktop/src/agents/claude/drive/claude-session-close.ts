import type { DriverOptions, ManagedSession } from '@/agents/claude/drive/drive-channel'

type Sessions = Map<string, ManagedSession>

// A killed node-pty process reports its exit through a native callback that runs asynchronously
// after `kill()` returns. If the app quits before that callback fires, it can land mid-Node-
// environment-teardown and abort the process (#2494), so this waits for every kill to land,
// bounded so a process that never reports exit cannot hang the app's quit.
const CLOSE_TIMEOUT_MS = 5_000

export function closeSessions(options: DriverOptions, sessions: Sessions): Promise<void> {
  const exited = [...sessions].map(([sessionId, session]) => {
    session.ended = true
    const exit = session.process.onExit
      ? new Promise<void>((resolve) => session.process.onExit?.(resolve))
      : Promise.resolve()
    session.process.kill?.()
    session.close()
    options.ledger.release(sessionId)
    return exit
  })
  sessions.clear()
  options.gate.close()
  const timeout = new Promise<void>((resolve) =>
    options.schedule(() => resolve(), CLOSE_TIMEOUT_MS),
  )
  return Promise.race([Promise.all(exited).then(() => undefined), timeout])
}
