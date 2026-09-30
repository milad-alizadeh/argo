import { en as copy } from '../locales'
import type { SessionFeedRow } from './feed-rows'

type LabeledCall = {
  kind: Extract<SessionFeedRow, { shape: 'tool' }>['kind'] | 'thought'
  label: string
  agentDescription?: boolean
}

const commandPrefix = copy.activity.command.split('{{command}}')[0] ?? ''

// A running command or unclassified tool reads "Running <work>". The agent's own sentence stays.
export function displayedToolLabel(call: LabeledCall, active: boolean, running: string) {
  if (!active || call.agentDescription === true) return call.label
  switch (call.kind) {
    case 'command':
    case 'tool':
      return `${running} ${
        commandPrefix.length > 0 && call.label.startsWith(commandPrefix)
          ? call.label.slice(commandPrefix.length)
          : call.label
      }`
    case 'read':
    case 'edited':
    case 'created':
    case 'deleted':
    case 'skill':
    case 'searched':
    case 'thought':
      return call.label
  }
}
