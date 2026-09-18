import { useEffect, useRef, useState } from 'react'
import { setupAnswers } from '../../contract/setup-configuration'
import type { SetupDocument } from '../../contract/setup-document'

export type SetupAnswer = string | boolean

export function useSetupAnswers(
  document: SetupDocument,
  configurationSource: string,
  onAnswersChange: ((answers: Readonly<Record<string, SetupAnswer>>) => void) | undefined,
) {
  const [answers, setAnswers] = useState<Record<string, SetupAnswer>>(() =>
    setupAnswers(document, configurationSource),
  )
  const answersRef = useRef(answers)
  const onAnswersChangeRef = useRef(onAnswersChange)
  onAnswersChangeRef.current = onAnswersChange
  useEffect(() => {
    const next = answersForRevision(answersRef.current, document)
    answersRef.current = next
    setAnswers(next)
    onAnswersChangeRef.current?.(next)
  }, [document])
  const update = (id: string, value: SetupAnswer) => {
    const next = { ...answersRef.current, [id]: value }
    answersRef.current = next
    setAnswers(next)
    onAnswersChangeRef.current?.(next)
  }
  return { answers, update }
}

function answersForRevision(current: Record<string, SetupAnswer>, document: SetupDocument) {
  return Object.fromEntries(
    document.fields.flatMap((field) => {
      const answer = current[field.id]
      if (answer !== undefined) return [[field.id, answer]]
      return field.recommendation === undefined ? [] : [[field.id, field.recommendation]]
    }),
  ) as Record<string, SetupAnswer>
}
