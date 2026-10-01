import { execFile } from 'node:child_process'

// `held` means another process holds an exclusive or shared flock on the file now.
export type LockState = 'held' | 'free' | 'missing'

const LOCK_STATES = new Set<string>(['held', 'free', 'missing'])
// Files per perl run, well under the platform's argument limit.
const PROBE_BATCH = 256
const PROBE_TIMEOUT_MS = 5_000

// Node has no flock, so perl takes LOCK_EX|LOCK_NB on each file and lets go at once.
const PROBE_SCRIPT = [
  'use Fcntl qw(:flock);',
  '$| = 1;',
  'for my $file (@ARGV) {',
  '  if (open(my $handle, "<", $file)) {',
  '    if (flock($handle, LOCK_EX | LOCK_NB)) { flock($handle, LOCK_UN); print "free\\n" }',
  '    else { print "held\\n" }',
  '    close($handle);',
  '  } else { print "missing\\n" }',
  '}',
].join('\n')

function probeBatch(files: readonly string[]): Promise<LockState[]> {
  return new Promise((resolve, reject) => {
    execFile(
      '/usr/bin/perl',
      ['-e', PROBE_SCRIPT, ...files],
      { timeout: PROBE_TIMEOUT_MS },
      (error, stdout) => {
        if (error !== null) return reject(error)
        const states = stdout.split('\n').filter((line) => line !== '')
        if (states.length !== files.length || !states.every((state) => LOCK_STATES.has(state)))
          return reject(new Error(`The lock probe answered ${states.length} of ${files.length}.`))
        resolve(states as LockState[])
      },
    )
  })
}

// Whether a process holds each file's flock, probed without waiting for any of them.
export async function probeLocks(files: readonly string[]): Promise<Map<string, LockState>> {
  const states = new Map<string, LockState>()
  for (let start = 0; start < files.length; start += PROBE_BATCH) {
    const batch = files.slice(start, start + PROBE_BATCH)
    const answers = await probeBatch(batch)
    batch.forEach((file, index) => {
      const state = answers[index]
      if (state !== undefined) states.set(file, state)
    })
  }
  return states
}
