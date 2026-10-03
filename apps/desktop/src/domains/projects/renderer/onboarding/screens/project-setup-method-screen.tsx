import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_HARNESS, harnessSchema } from '@/harnesses/harness'
import { harnessLabel } from '@/harnesses/presentation-registry'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/platform/renderer/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/renderer/components/ui/select'
import {
  defaultProjectSetupHarnesses,
  type ProjectSetupHarness,
} from '../model/project-setup-harness'
import type { ProjectSetupCommand, ProjectSetupSnapshot } from '../onboarding-presentation'

type SetupMethod = 'agent' | 'manual'

export function ProjectSetupMethodScreen({
  command,
  snapshot,
}: {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}) {
  const { t } = useTranslation('projects')
  const availableHarnesses = usableHarnesses(snapshot)
  const [method, setMethod] = useState<SetupMethod>(() =>
    availableHarnesses.length > 0 ? 'agent' : 'manual',
  )
  const [preferredHarness, setPreferredHarness] = useState<ProjectSetupHarness>(
    () => availableHarnesses[0]?.harness ?? DEFAULT_HARNESS,
  )
  const selectedHarness = chosenHarness(availableHarnesses, preferredHarness)
  const continueSetup = () => {
    if (method === 'agent' && selectedHarness) {
      return command({ type: 'choose-agent', harness: selectedHarness })
    }
    return command({ type: 'choose-manual' })
  }

  return (
    <>
      <RadioGroup
        aria-label={t('setup.actor.choosing-method.description')}
        className="mt-6 gap-3"
        onValueChange={(value) => {
          if (value === 'agent' || value === 'manual') setMethod(value)
        }}
        value={method}
      >
        {selectedHarness ? (
          <MethodChoice
            description={t('setup.actor.choosing-method.agent.description')}
            icon={<Icon name="sparkles" />}
            selected={method === 'agent'}
            title={t('setup.actor.choosing-method.agent.title')}
            value="agent"
          >
            <label
              className="grid w-full max-w-64 gap-1.5 type-control font-medium"
              htmlFor="project-setup-harness"
            >
              {t('setup.actor.choosing-method.harnessLabel')}
              <Select
                items={availableHarnesses.map(({ harness }) => ({
                  label: harnessLabel(harness),
                  value: harness,
                }))}
                onValueChange={(value) => {
                  const chosen = harnessSchema.safeParse(value)
                  if (chosen.success) setPreferredHarness(chosen.data)
                }}
                value={selectedHarness}
              >
                <SelectTrigger className="w-full" id="project-setup-harness">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableHarnesses.map(({ harness }) => (
                    <SelectItem key={harness} value={harness}>
                      {harnessLabel(harness)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </MethodChoice>
        ) : null}
        <MethodChoice
          description={t('setup.actor.choosing-method.manual.description')}
          icon={<Icon name="config-file" />}
          selected={method === 'manual'}
          title={t('setup.actor.choosing-method.manual.title')}
          value="manual"
        />
      </RadioGroup>
      <SetupMethodActions command={command} onContinue={continueSetup} />
    </>
  )
}

function MethodChoice({
  children,
  description,
  icon,
  selected,
  title,
  value,
}: {
  children?: ReactNode
  description: string
  icon: ReactNode
  selected: boolean
  title: string
  value: SetupMethod
}) {
  const controlId = `project-setup-method-${value}`
  const titleId = `${controlId}-title`
  const descriptionId = `${controlId}-description`
  return (
    <section
      className="group/choice relative flex cursor-pointer items-center gap-5 rounded-xl border px-4 py-4 transition-colors hover:bg-muted/20 group-has-[:focus-visible]/choice:border-ring group-has-[:focus-visible]/choice:ring-3 group-has-[:focus-visible]/choice:ring-ring/50 data-[selected=true]:border-foreground data-[selected=true]:bg-muted/40 data-[selected=true]:ring-1 data-[selected=true]:ring-foreground data-[selected=true]:ring-inset max-sm:flex-col max-sm:items-stretch"
      data-selected={selected}
    >
      <label className="absolute inset-0 z-0 cursor-pointer rounded-xl" htmlFor={controlId}>
        <span aria-hidden="true" className="sr-only">
          {title}
        </span>
      </label>
      <div className="pointer-events-none flex min-w-0 flex-1 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted transition-colors group-data-[selected=true]/choice:bg-foreground group-data-[selected=true]/choice:text-background [&_svg]:size-4">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="type-heading" id={titleId}>
            {title}
          </h2>
          <p
            className="mt-1 max-w-xl type-control leading-relaxed text-muted-foreground"
            id={descriptionId}
          >
            {description}
          </p>
        </div>
      </div>
      <div className="relative z-10 w-64 max-w-full shrink-0 max-sm:w-full">{children}</div>
      <RadioGroupItem
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="relative z-10"
        id={controlId}
        value={value}
      />
    </section>
  )
}

function usableHarnesses(snapshot: ProjectSetupSnapshot) {
  return (snapshot.harnesses ?? defaultProjectSetupHarnesses).filter(
    ({ unavailableReason }) => unavailableReason === null,
  )
}

function chosenHarness(
  harnesses: ReturnType<typeof usableHarnesses>,
  preferred: ProjectSetupHarness,
) {
  return harnesses.find(({ harness }) => harness === preferred)?.harness ?? harnesses[0]?.harness
}

function SetupMethodActions({
  command,
  onContinue,
}: {
  command: (command: ProjectSetupCommand) => Promise<void>
  onContinue: () => Promise<void>
}) {
  const { t } = useTranslation('projects')
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button onClick={() => void command({ type: 'defer' })} variant="ghost">
        {t('setup.actor.choosing-method.skipAction')}
      </Button>
      <Button onClick={() => void onContinue()}>
        {t('setup.actor.choosing-method.continueAction')}
      </Button>
    </div>
  )
}
