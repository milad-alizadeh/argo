import type { CodexProcess } from '@/agents/codex/drive/codex-channel'
import type { LiveMessage, LiveMessages } from '@/agents/codex/drive/live-messages'
import type { PendingCodexQuestion } from '@/agents/codex/drive/question-protocol'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/attachments-contract'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import type { QuestionAnswer } from '@/domains/sessions/contract/question'
import type { CodexTurnSetup } from './turn-setup-contract'

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
  interrupt: (sessionId: string) => Promise<void>
  compact: (sessionId: string) => Promise<void>
  rename: (sessionId: string, name: string) => Promise<string>
  roster: () => SessionRosterRow[]
  onRosterChanged: (listener: () => void) => () => void
  liveMessages: (sessionId: string) => LiveMessage[]
  isLockedElsewhere: (sessionId: string) => boolean
  pendingQuestion: (sessionId: string) => PendingCodexQuestion | null
  decideQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => boolean
  close: () => void
}

export type CodexSessionDrive = Pick<
  CodexSessionDriver,
  | 'start'
  | 'send'
  | 'interrupt'
  | 'compact'
  | 'rename'
  | 'roster'
  | 'liveMessages'
  | 'pendingQuestion'
  | 'decideQuestion'
  | 'close'
>
