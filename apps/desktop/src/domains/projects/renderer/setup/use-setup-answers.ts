import { useRef } from 'react'
import { type SetupDocument, setupAnswers } from '@/domains/projects/contract/setup'

export type SetupAnswer = string | boolean

export function useSetupAnswers(
  document: SetupDocument,
  configurationSource: string,
  onAnswersChange: ((answers: Readonly<Record<string, SetupAnswer>>) => void) | undefined,
) {
  const answers = setupAnswers(document, configurationSource)
  const answersRef = useRef(answers)
  answersRef.current = answers
  const update = (id: string, value: SetupAnswer) => {
    const next = { ...answersRef.current, [id]: value }
    answersRef.current = next
    onAnswersChange?.(next)
  }
  return { answers, update }
}
