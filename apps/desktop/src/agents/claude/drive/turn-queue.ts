import { claudeTurn } from './claude-turn'

export type ClaudeTerminal = {
  write: (text: string) => void
  onData: (listener: (data: string) => void) => unknown
}
type Schedule = (callback: () => void, delayMs: number) => void

export const SUBMIT_DELAY_MS = 150
export const FIRST_FRAME_TIMEOUT_MS = 10_000
// Claude Code drops input that arrives before its interface is up. The end of its first
// synchronized frame is the earliest point measured to accept a paste, about 1 s after spawn (#2002).
const FIRST_FRAME = '\u001b[?2026l'

export type TurnQueue = { send: (text: string) => void; stop: () => void }

// Writes Turns into Claude's terminal one at a time, holding them until Claude draws its first frame.
export function createTurnQueue(terminal: ClaudeTerminal, schedule: Schedule): TurnQueue {
  let held: string[] | null = []
  let stopped = false
  const deliver = (turns: string[]) => {
    const [text, ...rest] = turns
    if (text === undefined || stopped) return
    const turn = claudeTurn(text)
    terminal.write(turn.paste)
    schedule(() => {
      if (stopped) return
      terminal.write(turn.submit)
      deliver(rest)
    }, SUBMIT_DELAY_MS)
  }
  const release = () => {
    if (held === null) return
    const turns = held
    held = null
    deliver(turns)
  }
  let tail = ''
  terminal.onData((data) => {
    if (held === null) return
    const seen = tail + data
    if (seen.includes(FIRST_FRAME)) release()
    else tail = seen.slice(-(FIRST_FRAME.length - 1))
  })
  schedule(release, FIRST_FRAME_TIMEOUT_MS)
  return {
    send(text) {
      if (held === null) deliver([text])
      else held.push(text)
    },
    stop() {
      stopped = true
    },
  }
}
