import type { SessionShellOutput } from '@/domains/sessions/contract/model'
import type { SessionShellCommand } from '@/domains/sessions/contract/model'

// A Shell selection is meaningful only once its adapter supplied a terminal to reveal (#2530).
export function workInspectorReveal(
  reveal: string | null,
  shell: SessionShellCommand | null,
  shellOutput: SessionShellOutput | null,
) {
  if (shell === null) return reveal
  return shellOutput?.state === 'available' ? reveal : null
}
