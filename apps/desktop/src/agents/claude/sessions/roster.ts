// Projecting one stitched chain into the row the Roster draws. A throwaway projection rebuilt
// from the transcripts every launch (ADR-0004, ADR-0008); nothing here is stored.

import {
  type SessionRosterRow as RosterRow,
  SESSION_POSTURES,
  type SessionEntry,
  type SessionTitle,
  TITLE_SOURCES,
} from '../../../core/sessions/models'
import type { SessionChain } from './chains'
import type { TranscriptMessage } from './records'
import { readExternalStatus } from './status'

export type { RosterRow, SessionTitle }
// The `managed | external` axis with `orphaned`, its third posture, beside it (CONTEXT.md L2).
// This slice discovers Sessions from transcripts alone: it owns no PTY and reads no ownership
// record, so every row it projects is `external`. Telling `orphaned` from `external` needs the
// durable record of past ownership that a managed slice writes, and inventing one here would be
// a false DIRECT.
export { SESSION_POSTURES, TITLE_SOURCES }

// A subagent's records are dropped here rather than read as the Session's own. Its turn ends when
// the subagent stops, and reading that as the Session stopping would state a fact about work that
// is still running.
export function chainMessages(chain: SessionChain): TranscriptMessage[] {
  return chain.files.flatMap((file) =>
    file.records.filter(
      (record): record is TranscriptMessage => record.kind === 'message' && !record.sidechain,
    ),
  )
}

// The reader's title outranks the summariser's whichever order they arrive in, and Argo's own
// derived name stands only where the CLI holds none.
function readTitle(chain: SessionChain): SessionTitle | null {
  const titles = chain.files.flatMap((file) =>
    file.records.filter((record) => record.kind === 'title'),
  )
  const custom = titles.findLast((title) => title.source === 'custom')
  if (custom !== undefined) return { text: custom.title, source: 'custom' }
  const summarised = titles.findLast((title) => title.source === 'summarised')
  if (summarised !== undefined) return { text: summarised.title, source: 'summarised' }
  const prompt = chain.files.find((file) => file.openingPrompt !== null)?.openingPrompt
  return prompt === undefined || prompt === null ? null : { text: prompt, source: 'first-prompt' }
}

// The relocated half is the live one, so the merged Session's cwd and branch are the newest
// link's — read off the last message that carries them rather than off the origin.
function readPlace(messages: TranscriptMessage[]) {
  const located = messages.findLast((message) => message.cwd !== null)
  return { cwd: located?.cwd ?? null, branch: located?.branch ?? null }
}

// A chain is `headless` only where EVERY link is: a resume opened at a terminal continues the
// work a `-p` run started, and what is happening to it now is the fact the Roster draws.
function readChainEntry(messages: TranscriptMessage[]): SessionEntry {
  return messages.length > 0 && messages.every((message) => message.entry === 'headless')
    ? 'headless'
    : 'interactive'
}

export function projectRosterRow(chain: SessionChain): RosterRow {
  const messages = chainMessages(chain)
  const stamps = messages.flatMap((message) =>
    message.timestamp === null ? [] : [message.timestamp],
  )
  return {
    id: chain.id,
    retiredIds: chain.retiredIds,
    cli: 'claude',
    posture: 'external',
    title: readTitle(chain),
    status: readExternalStatus(messages),
    entry: readChainEntry(messages),
    ...readPlace(messages),
    updatedAt:
      stamps.length === 0
        ? null
        : stamps.reduce((latest, stamp) => (stamp > latest ? stamp : latest)),
    unreadableLines: chain.files.reduce((total, file) => total + file.unreadableLines, 0),
    originUnread: chain.originUnread,
  }
}
