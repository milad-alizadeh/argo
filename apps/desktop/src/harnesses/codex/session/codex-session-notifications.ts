import type { WireMessage } from '../app-server'

type Params = Record<string, unknown>

// Routes an app-server notification to the Session channel. Requests are handled separately.
export function dispatchCodexNotification(
  message: Extract<WireMessage, { method: string }>,
  handlers: {
    turnStarted: (params: Params) => void
    turnCompleted: (params: Params) => void
    threadStatusChanged: (params: Params) => void
    messageDelta: (params: Params) => void
    reasoningSummaryDelta: (params: Params) => void
    commandOutputDelta: (params: Params) => void
    itemNotification: (params: Params, phase: 'started' | 'completed') => void
  },
): undefined {
  const { params } = message
  switch (message.method) {
    case 'turn/started':
      handlers.turnStarted(params)
      return undefined
    case 'turn/completed':
      handlers.turnCompleted(params)
      return undefined
    case 'thread/status/changed':
      handlers.threadStatusChanged(params)
      return undefined
    case 'item/agentMessage/delta':
      handlers.messageDelta(params)
      return undefined
    case 'item/reasoning/summaryTextDelta':
      handlers.reasoningSummaryDelta(params)
      return undefined
    case 'item/commandExecution/outputDelta':
      handlers.commandOutputDelta(params)
      return undefined
    case 'item/completed':
      handlers.itemNotification(params, 'completed')
      return undefined
    case 'item/started':
      handlers.itemNotification(params, 'started')
      return undefined
    default:
      return undefined
  }
}
