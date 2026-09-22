import type { TranscriptRecord } from '@/domains/sessions/contract/model'

// Codex desktop writes each prompt twice: this model-input copy, then the `UserMessage` item the
// person sees, one ordinal later and under another id. The input copy also carries injected context.
export const MODEL_INPUT_PREFIX = 'model-input:'

// A thread with its own reader copy of a prompt keeps only those; one without keeps its input copies.
export function withoutModelInputCopies(records: TranscriptRecord[]): TranscriptRecord[] {
  const isInputCopy = (record: TranscriptRecord) =>
    'uuid' in record && record.uuid.startsWith(MODEL_INPUT_PREFIX)
  const hasReaderCopy = records.some(
    (record) => record.kind === 'message' && record.role === 'user' && !isInputCopy(record),
  )
  return hasReaderCopy ? records.filter((record) => !isInputCopy(record)) : records
}
