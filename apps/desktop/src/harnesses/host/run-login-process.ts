// Every Harness's `login` blocks on one spawned CLI process and reads the same three outcomes
// from it (#2579): the sign-in driver only differs in what it spawns, never in how it is watched.
import type { ChildProcess } from 'node:child_process'
import type { HarnessSignInOutcome } from '@/domains/harness-signin/main'

export function runLoginProcess(
  child: ChildProcess,
  signal: AbortSignal,
): Promise<HarnessSignInOutcome> {
  return new Promise<HarnessSignInOutcome>((resolve) => {
    let canceled = false
    const onAbort = () => {
      canceled = true
      child.kill()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    child.once('error', () => {
      signal.removeEventListener('abort', onAbort)
      resolve('failed')
    })
    child.once('exit', (code) => {
      signal.removeEventListener('abort', onAbort)
      if (canceled) resolve('canceled')
      else resolve(code === 0 ? 'completed' : 'failed')
    })
  })
}
