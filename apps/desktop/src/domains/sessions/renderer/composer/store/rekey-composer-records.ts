import { rekeyComposerRecord } from './rekey-composer-record'
import type { ComposerState } from '../hooks'

type ComposerRecords = Pick<
  ComposerState,
  'attachments' | 'drafts' | 'markers' | 'pendingTurns' | 'setup' | 'tickets'
>

export function rekeyComposerRecords(state: ComposerRecords, from: string, to: string) {
  return {
    attachments: rekeyComposerRecord(state.attachments, from, to),
    drafts: rekeyComposerRecord(state.drafts, from, to),
    markers: rekeyComposerRecord(state.markers, from, to),
    pendingTurns: rekeyComposerRecord(state.pendingTurns, from, to),
    setup: rekeyComposerRecord(state.setup, from, to),
    tickets: rekeyComposerRecord(state.tickets, from, to),
  }
}
