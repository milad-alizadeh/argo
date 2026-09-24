import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../../session-contract-error'
import { invalidateSessionList } from '../../session-queries'

export function useSessionQuestion(sessionId: string | null) {
  const [failure, setFailure] = useState<{ questionId: string; message: string } | null>(null)
  const queryClient = useQueryClient()
  const decision = useQuestionDecision(sessionId)
  const decide = async (questionId: string, answers: QuestionAnswer[]) => {
    try {
      await decision.mutateAsync({ questionId, answers })
      setFailure(null)
      await invalidateSessionList(queryClient)
      return true
    } catch (error) {
      setFailure({
        questionId,
        message: error instanceof Error ? error.message : 'Argo could not send this answer.',
      })
      return false
    }
  }
  return {
    decide,
    failureFor: (questionId: string) =>
      failure?.questionId === questionId ? failure.message : null,
    answeringId: decision.isPending ? (decision.variables?.questionId ?? null) : null,
  }
}

function useQuestionDecision(sessionId: string | null) {
  return useMutation<void, SessionContractError, { questionId: string; answers: QuestionAnswer[] }>(
    {
      mutationFn: async ({ questionId, answers }) => {
        if (sessionId === null) throw new Error('No Session selected.')
        const reply = await window.argo.decideSessionQuestion({ sessionId, questionId, answers })
        switch (reply.type) {
          case 'session.accepted':
            return
          case 'session.error':
            return throwSessionContractError(reply)
          default:
            return throwUnexpectedSessionReply(reply)
        }
      },
    },
  )
}
