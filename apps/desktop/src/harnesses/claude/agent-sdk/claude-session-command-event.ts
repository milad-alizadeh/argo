import type { SessionCommand } from '@/domains/sessions/next/contract/session-command-contract'

export function eventFor(
  command: Exclude<SessionCommand, { type: 'session.start' | 'session.compact' }>,
) {
  switch (command.type) {
    case 'session.send':
      return { type: 'Send', prompt: command.prompt } as const
    case 'session.steer':
      return { type: 'Steer', prompt: command.prompt } as const
    case 'session.interrupt':
      return { type: 'Interrupt' } as const
    case 'session.decide':
      return { type: 'Decide', approvalId: command.approvalId, decision: command.decision } as const
    case 'session.answer':
      return { type: 'Answer', questionId: command.questionId, answer: command.answer } as const
    case 'session.rename':
      return { type: 'Rename', title: command.title } as const
    case 'session.close':
      return { type: 'Close' } as const
  }
}
