// Tells the Ticket sync supervisor whether a person can see the window, so it polls only then.
import type { TicketSyncSupervisorCommand } from './ticket-sync-supervisor-machine'

export function reportWindowVisibility(
  window: {
    isVisible(): boolean
    isMinimized(): boolean
    on(event: 'show' | 'hide' | 'minimize' | 'restore', listener: () => void): unknown
  },
  send: (command: TicketSyncSupervisorCommand) => void,
): void {
  const report = (visible: boolean) => send({ type: 'Visibility', visible })
  const reportCurrent = () => report(window.isVisible() && !window.isMinimized())
  window.on('show', reportCurrent)
  window.on('restore', reportCurrent)
  // On macOS a covered window emits hide while isVisible() stays true, and a later hide() emits nothing.
  window.on('hide', () => report(false))
  window.on('minimize', () => report(false))
  reportCurrent()
}
