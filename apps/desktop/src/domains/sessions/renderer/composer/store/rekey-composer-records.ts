import type { ComposerState } from '../hooks/use-composer-store'
import { rekeyComposerRecord } from './rekey-composer-record'

type ComposerRecords = Pick<
  ComposerState,
  'attachments' | 'drafts' | 'markers' | 'pendingTurns' | 'turnConfiguration' | 'tickets'
>

export function rekeyComposerRecords(state: ComposerRecords, from: string, to: string) {
  return {
    attachments: rekeyComposerRecord(state.attachments, from, to),
    drafts: rekeyComposerRecord(state.drafts, from, to),
    markers: rekeyComposerRecord(state.markers, from, to),
    pendingTurns: rekeyComposerRecord(state.pendingTurns, from, to),
    turnConfiguration: rekeyComposerRecord(state.turnConfiguration, from, to),
    tickets: rekeyComposerRecord(state.tickets, from, to),
  }
}
