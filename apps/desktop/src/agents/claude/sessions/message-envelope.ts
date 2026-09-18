import type { TranscriptMessage } from '../../../domains/sessions/contract/transcript'

type MessageEnvelope = Pick<
  TranscriptMessage,
  'parentUuid' | 'originSessionId' | 'sidechain' | 'cwd' | 'branch' | 'timestamp'
>

export function messageEnvelope(record: Record<string, unknown>): MessageEnvelope {
  return {
    parentUuid: typeof record.parentUuid === 'string' ? record.parentUuid : null,
    originSessionId: typeof record.session_id === 'string' ? record.session_id : null,
    sidechain: record.isSidechain === true,
    cwd: typeof record.cwd === 'string' ? record.cwd : null,
    branch: typeof record.gitBranch === 'string' ? record.gitBranch : null,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
  }
}
