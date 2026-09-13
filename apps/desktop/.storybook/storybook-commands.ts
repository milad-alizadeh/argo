export const STORYBOOK_COMMAND_EVENT = 'argo:storybook-command'

const commandListeners = new Set<(command: string) => void>()

window.addEventListener(STORYBOOK_COMMAND_EVENT, (event) => {
  if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return
  for (const listener of commandListeners) listener(event.detail)
})

export function subscribeToStorybookCommands(listener: (command: string) => void) {
  commandListeners.add(listener)
  return () => commandListeners.delete(listener)
}
