import { Bot } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/renderer/components/ui/select'
import type { OnboardingController, OnboardingHarness } from './project-onboarding'
import { ProjectOnboardingStageHeader as StageHeading } from './project-onboarding-layout'
import { BackAction } from './project-onboarding-primitives'

const HARNESS_CHOICES = [
  { label: 'Codex', value: 'codex' },
  { label: 'Claude Code', value: 'claude' },
] as const

export function NoDefaultHarnessStage({ controller }: { controller: OnboardingController }) {
  const { actions } = controller
  const [choice, setChoice] = useState<OnboardingHarness>('codex')
  return (
    <>
      <StageHeading
        back={<BackAction controller={controller} />}
        description="Choose a default harness before Argo analyzes the Project. This choice also becomes the default for new Sessions."
      >
        Choose your default harness
      </StageHeading>
      <div className="mt-8 max-w-md space-y-3">
        <HarnessSelect label="Default harness" onChange={setChoice} value={choice} />
        <Button className="w-full" onClick={() => actions.configureDefaultHarness(choice)}>
          Save default harness
        </Button>
      </div>
    </>
  )
}

export function HarnessStage({ controller }: { controller: OnboardingController }) {
  const { actions, state } = controller
  return (
    <>
      <StageHeading
        back={<BackAction controller={controller} />}
        description="Argo will start a short-lived agent that plans setup for this Project. It will not write files during planning."
      >
        Choose the setup agent
      </StageHeading>
      <div className="mt-8 max-w-lg rounded-xl border bg-card p-5 shadow-surface">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <HarnessSelect label="Harness" onChange={actions.setHarness} value={state.harness} />
            <p className="mt-3 type-label text-muted-foreground">
              The agent can read Project files. Argo applies changes in a separate phase that you
              start later.
            </p>
          </div>
        </div>
        <Button className="mt-5 w-full" onClick={actions.beginAnalysis}>
          Plan Project setup
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
