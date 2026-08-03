import { derived } from '../../../shared'
import { emptyTranscript } from '../claudeTranscript'
import { emptyTurn } from '../turnFacts'
import type { LogicalSession, ParsedTranscript } from '../types'

// The parsed-transcript builders the observer's tests read. One home for the shape, so a field added
// to `ParsedTranscript` or `Turn` is a compile error here rather than in every test that happened to
// spell the whole object out.

// Built on the parser's OWN empty transcript rather than a second copy of that literal: a field
// added to the shape must not be able to reach the tests already filled in.
export const file = (over: Partial<ParsedTranscript>): ParsedTranscript => ({
  ...emptyTranscript('file-1'),
  ...over,
})

export const logicalOf = (...files: ParsedTranscript[]): LogicalSession => ({
  id: files[0].sessionId,
  fileIds: files.map((entry) => entry.sessionId),
  files,
})

export const running = () => derived('running' as const)

// Built on the parser's own empty Turn, for the same reason `file` is built on `emptyTranscript`.
export const turn = (id: string, over: { startedAtMs?: number; endedAtMs?: number } = {}) => ({
  ...emptyTurn(id, null),
  ...over,
})
