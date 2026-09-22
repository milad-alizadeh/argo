import { CYCLE_MODE, REDRAW } from '@/harnesses/claude/drive/claude-setup.ts'

// The Modes this mock offers, in the order Shift+Tab reaches them.
export const FOOTERS = ['manual mode on', 'accept edits on', 'plan mode on', 'auto mode on']

// A Claude TUI that redraws its Mode footer on Ctrl+L, one Mode on per Shift+Tab.
export function terminal(writes: string[]) {
  let listener: (data: string) => void = () => {}
  let footer = 0
  return {
    write: (text: string) => {
      writes.push(text)
      if (text === CYCLE_MODE) footer = (footer + 1) % FOOTERS.length
      if (text === REDRAW) listener(`\u001b[2J\u001b[38;5;246m⏵⏵ ${FOOTERS[footer]}\u001b[39m`)
    },
    onData: (next: (data: string) => void) => {
      listener = next
    },
    paint: (data: string) => listener(data),
  }
}
