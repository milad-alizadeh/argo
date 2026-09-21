import { FileJson, Sparkles } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import {
  defaultProjectSetupHarnesses,
  type ProjectSetupHarness,
} from '@/domains/projects/contract/project-setup-harness'
import { Button } from '@/platform/renderer/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/platform/renderer/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/renderer/components/ui/select'

type SetupMethod = 'agent' | 'manual'

export function ProjectSetupMethodScreen({
  command,
  snapshot,
}: {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}) {
  const { t } = useTranslation('projects')
  const availableHarnesses = (snapshot.harnesses ?? defaultProjectSetupHarnesses).filter(
    ({ unavailableReason }) => unavailableReason === null,
  )
  const [method, setMethod] = useState<SetupMethod>(() =>
    availableHarnesses.length > 0 ? 'agent' : 'manual',
  )
  const [preferredHarness, setPreferredHarness] = useState<ProjectSetupHarness>(
    () => availableHarnesses[0]?.harness ?? 'claude',
  )
  const selectedHarness =
    availableHarnesses.find(({ harness }) => harness === preferredHarness)?.harness ??
    availableHarnesses[0]?.harness
  const harnessLabel = (harness: ProjectSetupHarness) =>
    t(`setup.harnessName.${harness}` as const)
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
            icon={<Sparkles />}
            onSelect={() => setMethod('agent')}
            selected={method === 'agent'}
            title={t('setup.actor.choosing-method.agent.title')}
            value="agent"
          >
            <label
              className="relative z-10 grid w-full max-w-64 gap-1.5 type-control font-medium"
              htmlFor="project-setup-harness"
              onFocusCapture={() => setMethod('agent')}
            >
              {t('setup.actor.choosing-method.harnessLabel')}
              <Select
                items={availableHarnesses.map(({ harness }) => ({
                  label: harnessLabel(harness),
                  value: harness,
                }))}
                onValueChange={(value) => {
                  if (value === 'claude' || value === 'codex') setPreferredHarness(value)
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
          icon={<FileJson />}
          onSelect={() => setMethod('manual')}
          selected={method === 'manual'}
          title={t('setup.actor.choosing-method.manual.title')}
          value="manual"
        />
      </RadioGroup>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={() => void command({ type: 'defer' })} variant="ghost">
          {t('setup.actor.choosing-method.skipAction')}
        </Button>
        <Button onClick={() => void continueSetup()}>
          {t('setup.actor.choosing-method.continueAction')}
        </Button>
      </div>
    </>
  )
}

function MethodChoice({
  children,
  description,
  icon,
  onSelect,
  selected,
  title,
  value,
}: {
  children?: ReactNode
  description: string
  icon: ReactNode
  onSelect: () => void
  selected: boolean
  title: string
  value: SetupMethod
}) {
  return (
    <section
      className="group/choice grid cursor-pointer grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] items-center gap-5 rounded-xl border border-border px-4 py-4 outline-none transition-[background-color,border-color,box-shadow] hover:border-foreground/30 hover:bg-muted/20 group-has-[:focus-visible]/choice:border-ring group-has-[:focus-visible]/choice:ring-3 group-has-[:focus-visible]/choice:ring-ring/50 data-[selected=true]:border-foreground data-[selected=true]:bg-muted/40 data-[selected=true]:shadow-[inset_0_0_0_1px_var(--foreground)] max-sm:grid-cols-1"
      data-selected={selected}
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted transition-colors group-data-[selected=true]/choice:bg-foreground group-data-[selected=true]/choice:text-background [&_svg]:size-4">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="type-heading">{title}</h2>
          <p className="mt-1 max-w-xl type-control leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div>{children}</div>
      <RadioGroupItem aria-label={title} className="sr-only" value={value} />
    </section>
  )
}
