import type { TranscriptMessage } from './transcript'

// The full TranscriptMessage shape, filled with the values a test that only cares about one or
// two fields shouldn't have to restate.
export function emptyMessage(
  overrides: Partial<TranscriptMessage> & { uuid: string },
): TranscriptMessage {
  return {
    kind: 'message',
    parentUuid: null,
    originSessionId: null,
    role: 'assistant',
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: null,
    entry: 'interactive',
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    blocks: [],
    toolCalls: [],
    answeredCalls: [],
    usage: null,
    ...overrides,
  }
}
