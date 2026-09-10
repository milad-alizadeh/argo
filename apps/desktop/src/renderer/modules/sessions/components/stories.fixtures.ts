// Whole readings, written out in full. A cast fixture (`{ id } as Session`) type-checks and then
// draws a story with every other fact missing, so the story stops being evidence of what the
// component draws. Every field here is the field the Roster and the Feed actually read.
import type { Session, SessionFeed, SessionFeedRow } from '../types'

export const sessionStory: Session = {
  id: 'askPending',
  retiredIds: [],
  cli: 'claude',
  posture: 'external',
  title: { text: 'Pick the ink', source: 'first-prompt' },
  status: 'asking',
  entry: 'interactive',
  cwd: '/Users/x/proj',
  branch: 'main',
  updatedAt: '2026-08-20T09:24:00.000Z',
  unreadableLines: 0,
  originUnread: false,
  turnStartedAt: '2026-08-20T09:20:00.000Z',
  activity: { tool: 'AskUserQuestion', target: null },
  plan: null,
  delegations: [{ id: 'call-verify', label: 'verify the fold', landed: true }],
  shell: [],
  pullRequest: null,
  archived: false,
}

// A Session Argo started and that is working now: a Plan part done, two Subagents running under
// it and one home, and the tool it last called. The reading the row has the most to draw from.
export const workingSessionStory: Session = {
  id: 'plannedWork',
  retiredIds: [],
  cli: 'claude',
  posture: 'managed',
  title: { text: 'The rail reads the Subagents’ own records', source: 'first-prompt' },
  status: 'running',
  entry: 'interactive',
  cwd: '/Users/x/proj/.claude/worktrees/ticket-1269-rail',
  branch: 'argo/#1269-rail',
  updatedAt: '2026-08-20T10:08:00.000Z',
  unreadableLines: 0,
  originUnread: false,
  turnStartedAt: '2026-08-20T10:05:00.000Z',
  activity: { tool: 'Edit', target: 'SubagentDots.tsx' },
  plan: { total: 7, completed: 3, inProgress: 1 },
  delegations: [
    { id: 'call-read', label: 'Read the rail', landed: false },
    { id: 'call-dots', label: null, landed: false },
    { id: 'call-count', label: 'Count the landed calls', landed: true },
  ],
  shell: [{ id: 'call-bash', command: 'bun run --cwd apps/desktop test', background: false }],
  pullRequest: {
    number: 1312,
    url: 'https://github.com/milad-alizadeh/argo/pull/1312',
    repository: 'milad-alizadeh/argo',
  },
  archived: false,
}

// A Session Argo could only read in part: a resumed half whose origin is in no file it reached,
// with a damaged line and no working directory. The row has to say all three (CONTEXT.md L1 ·
// degrade down), so one story stands for the absent facts rather than none of them.
export const partialSessionStory: Session = {
  id: 'strandedResume',
  retiredIds: ['sr-retired'],
  cli: 'claude',
  posture: 'orphaned',
  title: null,
  status: 'unknown',
  entry: 'headless',
  cwd: null,
  branch: null,
  updatedAt: null,
  unreadableLines: 2,
  originUnread: true,
  turnStartedAt: null,
  activity: null,
  plan: null,
  delegations: [{ id: 'call-open', label: null, landed: false }],
  shell: [],
  pullRequest: null,
  archived: false,
}

// A Session the reader put away. The flag is the Claude desktop app's own, so this is a Session
// archived in that app and read here (`sessions/archive.ts`).
export const archivedSessionStory: Session = {
  ...sessionStory,
  id: 'prose',
  title: { text: 'The ink of a row nobody is waiting on', source: 'first-prompt' },
  status: 'ended',
  activity: null,
  delegations: [],
  archived: true,
}

export const sessionsStory: readonly Session[] = [
  workingSessionStory,
  sessionStory,
  partialSessionStory,
  archivedSessionStory,
]

export const feedRowStory: SessionFeedRow = {
  shape: 'prose',
  id: 'prose:asst-1',
  role: 'assistant',
  text: [
    'The ink is the **ground colour** of the panel, so the row reads as marked rather than edged.',
    '',
    '- `SessionListItem` draws the ground from `bg-sidebar-accent`.',
    '- The pane head and the row share one [token](https://example.com).',
  ].join('\n'),
}

const sourceRowStory: SessionFeedRow = {
  shape: 'source',
  id: 'prose:tool-1',
  role: 'assistant',
  label: 'tool_use',
  source: '{\n  "name": "Read",\n  "input": { "file_path": "docs/adr/0033-feed-geometry.md" }\n}',
}

const unreadableRowStory: SessionFeedRow = { shape: 'unreadable', id: 'unreadable:3' }

// A Thought whose text the CLI kept, and the two points a Feed marks in its Turn sequence.
const thoughtRowStory: SessionFeedRow = {
  shape: 'thought',
  id: 'asst-1:0',
  text: 'The row already has a ground, so a rule would be a second mark for one fact.',
}
const compactedRowStory: SessionFeedRow = {
  shape: 'marker',
  id: 'c-1:compacted',
  marker: 'compacted',
}
const interruptedRowStory: SessionFeedRow = { shape: 'marker', id: 'u-2:0', marker: 'interrupted' }

// Every shape, so the story draws the Feed a damaged transcript produces as well as a clean
// one. The two ids are the ones the shipped rows carry: the shape, then the line it came from.
export const feedRowsStory: readonly SessionFeedRow[] = [
  { shape: 'prose', id: 'prose:user-1', role: 'user', text: 'Read this file and tell me why.' },
  thoughtRowStory,
  feedRowStory,
  sourceRowStory,
  interruptedRowStory,
  compactedRowStory,
  unreadableRowStory,
]

export const feedStory: SessionFeed = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'feed-story',
  sessionId: 'prose',
  chainId: 'prose',
  rows: [...feedRowsStory],
}
