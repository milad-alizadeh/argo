import { Bot } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/renderer/components/ui/select'
import type { OnboardingController, OnboardingHarness } from './project-onboarding'
import { StageHeadingWithBack } from './project-onboarding-stage-navigation'

const HARNESS_CHOICES = [
  { label: 'Codex', value: 'codex' },
  { label: 'Claude Code', value: 'claude' },
] as const

export function NoDefaultHarnessStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions } = controller
  const [choice, setChoice] = useState<OnboardingHarness>('codex')
  return (
    <>
      <StageHeadingWithBack
        controller={controller}
        description={t('onboarding.flow.defaultHarness.description')}
        title={t('onboarding.flow.defaultHarness.title')}
      />
      <div className="mt-8 max-w-md space-y-3">
        <HarnessSelect
          label={t('onboarding.flow.defaultHarness.label')}
          onChange={setChoice}
          value={choice}
        />
        <Button className="w-full" onClick={() => actions.configureDefaultHarness(choice)}>
          {t('onboarding.flow.defaultHarness.save')}
        </Button>
      </div>
    </>
  )
}

export function HarnessStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  return (
    <>
      <StageHeadingWithBack
        controller={controller}
        description={t('onboarding.flow.harness.description')}
        title={t('onboarding.flow.harness.title')}
      />
      <div className="mt-8 max-w-lg rounded-xl border bg-card p-5 shadow-surface">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <HarnessSelect
              label={t('onboarding.flow.harness.label')}
              onChange={actions.setHarness}
              value={state.harness}
            />
            <p className="mt-3 type-label text-muted-foreground">
              {t('onboarding.flow.harness.note')}
            </p>
          </div>
        </div>
        <Button className="mt-5 w-full" onClick={actions.beginAnalysis}>
          {t('onboarding.flow.harness.plan')}
        </Button>
      </div>
    </>
  )
}

export function HarnessSelect({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: OnboardingHarness) => void
  value: OnboardingHarness
}) {
  return (
    <div>
      <label className="mb-1.5 block type-body font-medium" htmlFor={`${label}-onboarding`}>
        {label}
      </label>
      <Select
        items={HARNESS_CHOICES}
        onValueChange={(nextValue) => {
          if (nextValue === 'codex' || nextValue === 'claude') onChange(nextValue)
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={`${label}-onboarding`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HARNESS_CHOICES.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
