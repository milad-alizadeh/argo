import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { Button } from '@/platform/renderer/components/ui/button'

type InputScreenProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}

export function InputScreen({ command, snapshot }: InputScreenProps) {
  switch (snapshot.screen) {
    case 'questions':
      return <Questions command={command} snapshot={snapshot} />
    case 'invalid-plan':
      return <InvalidPlan command={command} />
    case 'manual':
      return <Manual command={command} snapshot={snapshot} />
    default:
      return null
  }
}

function Questions({ command, snapshot }: InputScreenProps) {
  const { t } = useTranslation('projects')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const submitAnswers = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const completed = snapshot.questions.map(({ id }) => ({ id, answer: answers[id] ?? '' }))
    if (completed.every(({ answer }) => answer.trim().length > 0)) {
      void command({ type: 'answer-questions', answers: completed })
    }
  }
  return (
    <form className="mt-6 grid gap-4" onSubmit={submitAnswers}>
      {snapshot.questions.map((question) => (
        <label className="grid gap-2 type-body" key={question.id}>
          <span>{question.prompt}</span>
          <input
            className="rounded-md border p-3"
            onChange={(event) =>
              setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
            }
            value={answers[question.id] ?? ''}
          />
        </label>
      ))}
      <Button type="submit">{t('setup.actor.questions.continue')}</Button>
    </form>
  )
}

function InvalidPlan({ command }: Pick<InputScreenProps, 'command'>) {
  const { t } = useTranslation('projects')
  const [feedback, setFeedback] = useState('')
  return (
    <div className="mt-6 grid gap-3">
      <textarea
        aria-label={t('setup.actor.invalid-plan.feedbackLabel')}
        className="min-h-24 rounded-md border p-3 type-body"
        onChange={(event) => setFeedback(event.target.value)}
        value={feedback}
      />
      <Button
        disabled={feedback.trim().length === 0}
        onClick={() => void command({ type: 'request-plan-change', feedback })}
      >
        {t('setup.actor.invalid-plan.changeAction')}
      </Button>
    </div>
  )
}

function Manual({ command, snapshot }: InputScreenProps) {
  const { t } = useTranslation('projects')
  const [source, setSource] = useState(snapshot.manualSource)
  useEffect(() => setSource(snapshot.manualSource), [snapshot.manualSource])
  return (
    <div className="mt-6 grid gap-3">
      <textarea
        aria-label={t('setup.configurationLabel')}
        className="min-h-64 rounded-md border p-3 font-mono"
        onChange={(event) => setSource(event.target.value)}
        value={source}
      />
      <div className="flex gap-3">
        <Button onClick={() => void command({ type: 'save-manual', source })}>
          {t('setup.actor.manual.action')}
        </Button>
        <Button onClick={() => void command({ type: 'back' })} variant="outline">
          {t('setup.document.back')}
        </Button>
      </div>
    </div>
  )
}
