// One PTY, wrapped so a test can wait for text instead of racing a stream. Used only by the
// acceptance harness (`pty-acceptance.ts`), which runs inside the PACKAGED app.
import * as pty from 'node-pty'

export const DEFAULT_COLS = 80
export const DEFAULT_ROWS = 24

export class PtySession {
  readonly child: pty.IPty
  private buffer = ''
  private exits = 0
  private readonly waiters: { needle: string; resolve: () => void }[] = []

  constructor(command: string, args: string[], cwd: string) {
    this.child = pty.spawn(command, args, {
      name: 'xterm-color',
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      cwd,
      env: { ...process.env } as Record<string, string>,
    })
    this.child.onData((chunk) => {
      this.buffer += chunk
      for (const waiter of [...this.waiters]) {
        if (!this.buffer.includes(waiter.needle)) continue
        this.waiters.splice(this.waiters.indexOf(waiter), 1)
        waiter.resolve()
      }
    })
    // Counted rather than awaited, because "exactly once" is the property under test.
    this.child.onExit(() => {
      this.exits += 1
    })
  }

  get exitCount(): number {
    return this.exits
  }

  write(input: string): void {
    this.child.write(input)
  }

  resize(cols: number, rows: number): void {
    this.child.resize(cols, rows)
  }

  kill(): void {
    this.child.kill()
  }

  // Resolves when `needle` has appeared in everything the PTY has said so far, so a token that
  // arrived before the wait started still counts.
  waitFor(needle: string, timeoutMs: number): Promise<void> {
    if (this.buffer.includes(needle)) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const waiter = { needle, resolve: () => {} }
      const timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter)
        if (index >= 0) this.waiters.splice(index, 1)
        reject(new Error(`no ${JSON.stringify(needle)} in ${timeoutMs}ms. Saw: ${this.tail()}`))
      }, timeoutMs)
      waiter.resolve = () => {
        clearTimeout(timer)
        resolve()
      }
      this.waiters.push(waiter)
    })
  }

  tail(limit = 400): string {
    return JSON.stringify(this.buffer.slice(-limit))
  }
}
