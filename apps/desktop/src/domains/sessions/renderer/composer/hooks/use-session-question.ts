import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import { trpcClient } from '@/platform/renderer/trpc-client'

// A pending Question reaches the renderer through the Feed, so this hook only decides.
export function useSessionQuestion(sessionId: string | null) {
  const [failure, setFailure] = useState<{ questionId: string; message: string } | null>(null)
  const decision = useQuestionDecision(sessionId)
  const decide = async (questionId: string, answers: QuestionAnswer[]) => {
    try {
      await decision.mutateAsync({ questionId, answers })
      setFailure(null)
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
    // A failed answer stays in the Question row for retry.
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
