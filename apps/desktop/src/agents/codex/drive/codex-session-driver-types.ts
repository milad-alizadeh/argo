import type { CodexProcess } from '@/agents/codex/drive/codex-channel'
import type { LiveMessage, LiveMessages } from '@/agents/codex/drive/live-messages'
import type { PendingCodexQuestion } from '@/agents/codex/drive/question-protocol'
import type { CodexTurnSetup } from '@/agents/codex/drive/turn-setup-contract'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'

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
