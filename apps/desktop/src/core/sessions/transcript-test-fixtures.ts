import type { TranscriptMessage } from './transcript'

export function transcriptMessage(
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
    toolResults: [],
    answeredCalls: [],
    usage: null,
    ...overrides,
  }
}
