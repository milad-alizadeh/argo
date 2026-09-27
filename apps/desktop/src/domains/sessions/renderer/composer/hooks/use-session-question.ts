import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { invalidateSessionList } from '../../session-queries'

// A pending question already reaches the renderer through the Feed's own `ask` row (tool-feed.ts),
// so this hook only decides — there is nothing to poll (unlike `useSessionPermission`).
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
    // Kept in the retry: a failed answer stays exactly as the reader composed it, so this names
    // which row's answer is still available rather than clearing it.
    failureFor: (questionId: string) =>
      failure?.questionId === questionId ? failure.message : null,
    answeringId: decision.isPending ? (decision.variables?.questionId ?? null) : null,
  }
}

function useQuestionDecision(sessionId: string | null) {
  return useMutation<void, Error, { questionId: string; answers: QuestionAnswer[] }>({
    mutationFn: async ({ questionId, answers }) => {
      if (sessionId === null) throw new Error('No Session selected.')
      await trpcClient.sessionQuestionDecide.mutate({ sessionId, questionId, answers })
    },
  })
}
