// Tells the Ticket sync supervisor whether a person can see the window, so it polls only then.
import type { BrowserWindow } from 'electron'
import type { TicketSyncSupervisorCommand } from './ticket-sync-supervisor-machine'

export function reportWindowVisibility(
  window: Pick<BrowserWindow, 'isVisible' | 'isMinimized' | 'on'>,
  send: (command: TicketSyncSupervisorCommand) => void,
): void {
  const report = () =>
    send({ type: 'Visibility', visible: window.isVisible() && !window.isMinimized() })
  window.on('show', report)
  window.on('hide', report)
  window.on('minimize', report)
  window.on('restore', report)
  report()
}
