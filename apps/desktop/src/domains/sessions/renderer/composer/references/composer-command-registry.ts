import { useSyncExternalStore } from 'react'
import type { ComposerCommand } from '@/domains/sessions/api/composer-commands'
import type { Harness } from '@/harnesses/harness'

const EMPTY: readonly ComposerCommand[] = []
const commands = new Map<Harness, readonly ComposerCommand[]>()
const listeners = new Set<() => void>()

export function replaceComposerCommands(harness: Harness, next: readonly ComposerCommand[]) {
  commands.set(harness, next)
  for (const listener of listeners) listener()
}

export function useHarnessCommands(harness: Harness | null): readonly ComposerCommand[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => (harness === null ? EMPTY : (commands.get(harness) ?? EMPTY)),
    () => EMPTY,
  )
}
