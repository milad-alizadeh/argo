import type {
  SessionAdapter,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'

export type CodexSessionAdapter = SessionAdapter & {
  close: () => void
  projections: () => readonly SessionProjection[]
}
