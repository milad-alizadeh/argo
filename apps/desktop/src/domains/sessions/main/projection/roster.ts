// Projecting one stitched chain into the row the Roster draws. A throwaway projection rebuilt
// from the transcripts every launch (ADR-0004, ADR-0008); nothing here is stored.

import type { SessionChain } from '@/domains/sessions/contract/model'
import {
  type SessionRosterRow as RosterRow,
  SESSION_POSTURES,
  type SessionEntry,
  type SessionTitle,
  TITLE_SOURCES,
} from '@/domains/sessions/contract/model'
import type {
  TranscriptMessage,
  TranscriptRecord,
} from '@/domains/sessions/contract/model'
import { observedRosterRow } from '@/domains/sessions/contract/observation'
import {
  type BackgroundTask,
  readActivity,
  readShellCommands,
  readSubagents,
  readTurnStartedAt,
} from '@/domains/sessions/contract/observation'
import { readSetup } from '../composition'
import { readPlan } from './plan'
import { readExternalStatus } from './status'

export type { RosterRow, SessionTitle }
// The `managed | external` axis (CONTEXT.md L2). This slice discovers Sessions from transcripts
// alone: it owns no PTY, so every row it projects is `external`. Whether Argo currently holds a
// live channel to that Session is a fact only the managed slice's ownership ledger knows.
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

// The completion notifications the chain carries, whatever tool started the task they end.
export function chainBackgroundTasks(chain: SessionChain): BackgroundTask[] {
  return chain.files.flatMap((file) =>
    file.records.filter((record): record is BackgroundTask => record.kind === 'background-task'),
  )
}

// The reader's title outranks the summariser's whichever order they arrive in, and Argo's own
// derived name stands only where the Harness holds none.
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
// link's — read off the last message that carries them rather than off the origin. Codex writes
// the cwd and branch on its `session_meta` trace only (#2204).
function readPlace(chain: SessionChain, messages: TranscriptMessage[]) {
  const located = messages.findLast((message) => message.cwd !== null)
  // Codex names the branch once, on session_meta, and the folder again on every command it runs.
  const traces = chain.files
    .flatMap((file) => file.records)
    .filter(
      (record): record is Extract<TranscriptRecord, { kind: 'trace' }> => record.kind === 'trace',
    )
  return {
    cwd: located?.cwd ?? traces.findLast((trace) => typeof trace.cwd === 'string')?.cwd ?? null,
    branch:
      located?.branch ??
      traces.findLast((trace) => typeof trace.branch === 'string')?.branch ??
      null,
  }
}

// A chain is `headless` only where EVERY link is: a resume opened at a terminal continues the
// work a `-p` run started, and what is happening to it now is the fact the Roster draws.
function readChainEntry(messages: TranscriptMessage[]): SessionEntry {
  return messages.length > 0 && messages.every((message) => message.entry === 'headless')
    ? 'headless'
    : 'interactive'
}

// The newest link wins: a Session that opened a second pull request is working on that one now.
// Only a Claude transcript carries a `pull-request` record today; a chain that never does simply
// reads no pull request, which is the correct answer for every other Harness too.
function readPullRequest(chain: SessionChain) {
  const links = chain.files.flatMap((file) =>
    file.records.filter((record) => record.kind === 'pull-request'),
  )
  const newest = links.at(-1)
  return newest === undefined
    ? null
    : { number: newest.number, url: newest.url, repository: newest.repository }
}

function readUsage(messages: TranscriptMessage[]) {
  const reported = messages.flatMap((message) => (message.usage === null ? [] : [message.usage]))
  const latest = reported.at(-1)
  return {
    contextTokens:
      latest === undefined ? null : Object.values(latest).reduce((sum, value) => sum + value, 0),
    spentTokens:
      reported.length === 0
        ? null
        : reported.reduce((sum, usage) => sum + usage.inputTokens + usage.outputTokens, 0),
  }
}

function readRosterUsage(messages: TranscriptMessage[], records: TranscriptRecord[]) {
  const cumulative = records.findLast(
    (record): record is Extract<TranscriptRecord, { kind: 'usage' }> => record.kind === 'usage',
  )
  return cumulative === undefined
    ? readUsage(messages)
    : { contextTokens: cumulative.contextTokens, spentTokens: cumulative.spentTokens }
}

function readContextWindowTokens(chain: SessionChain) {
  return (
    chain.files
      .flatMap((file) => file.records)
      .findLast(
        (record): record is Extract<TranscriptRecord, { kind: 'trace' }> =>
          record.kind === 'trace' && record.contextWindowTokens !== undefined,
      )?.contextWindowTokens ?? null
  )
}

export function projectRosterRow(chain: SessionChain, harness: string): RosterRow {
  const messages = chainMessages(chain)
  const records = chain.files.flatMap((file) => file.records)
  const notifications = chainBackgroundTasks(chain)
  const stamps = messages.flatMap((message) =>
    message.timestamp === null ? [] : [message.timestamp],
  )
  return observedRosterRow({
    chain,
    harness,
    messages,
    notifications,
    title: readTitle(chain),
    status: readExternalStatus(messages, records),
    entry: readChainEntry(messages),
    place: readPlace(chain, messages),
    updatedAt:
      stamps.length === 0
        ? null
        : stamps.reduce((latest, stamp) => (stamp > latest ? stamp : latest)),
    turnStartedAt: readTurnStartedAt(messages),
    activity: readActivity(messages),
    plan: readPlan(chain.files.flatMap((file) => file.records)),
    subagents: readSubagents(records),
    shell: readShellCommands(messages, notifications),
    pullRequest: readPullRequest(chain),
    usage: readRosterUsage(messages, records),
    contextWindowTokens: readContextWindowTokens(chain),
    setup: readSetup(records),
  })
}
