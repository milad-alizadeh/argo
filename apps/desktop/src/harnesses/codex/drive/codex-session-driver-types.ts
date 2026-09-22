import type { CodexTurnSetup } from '@/domains/sessions/contract/codex-turn-setup'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive'
import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import type { CodexProcess } from './codex-channel'
import type { LiveMessage, LiveMessages } from './live-messages'
import type { PendingCodexPermission } from './permission-protocol'
import type { PendingCodexQuestion } from './question-protocol'

export type { CodexProcess, LiveMessage, LiveMessages }

export type CodexSessionDriver = {
  start: (request: {
    cwd: string
    prompt: string
    setup?: CodexTurnSetup
    attachments: SessionAttachmentInput[]
  }) => Promise<string>
  send: (request: {
    sessionId: string
    text: string
    setup: CodexTurnSetup | undefined
    attachments: SessionAttachmentInput[]
  }) => Promise<void>
  steer?: (request: {
    sessionId: string
    text: string
    attachments: SessionAttachmentInput[]
  }) => Promise<void>
  interrupt: (sessionId: string) => Promise<void>
  compact: (sessionId: string) => Promise<void>
  rename: (sessionId: string, name: string) => Promise<string>
  roster: () => SessionRosterRow[]
  onRosterChanged: (listener: () => void) => () => void
  liveMessages: (sessionId: string) => LiveMessage[]
  isLockedElsewhere: (sessionId: string) => boolean
  pendingQuestion: (sessionId: string) => PendingCodexQuestion | null
  pendingPermission: (sessionId: string) => PendingCodexPermission | null
  decidePermission: (
    sessionId: string,
    permissionId: string,
    decision: 'allow' | 'deny' | 'allowForSession' | 'cancel',
  ) => boolean
  decideQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => boolean
  close: () => void
}

export type CodexSessionDrive = Pick<
  CodexSessionDriver,
  | 'start'
  | 'send'
  | 'steer'
  | 'interrupt'
  | 'compact'
  | 'rename'
  | 'roster'
  | 'liveMessages'
  | 'pendingQuestion'
  | 'decideQuestion'
  | 'pendingPermission'
  | 'decidePermission'
  | 'close'
>
