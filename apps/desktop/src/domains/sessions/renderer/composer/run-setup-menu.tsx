import { Fragment, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { EffortSlider } from '@/domains/sessions/renderer/composer/effort-slider'
import {
  choiceLabel,
  effortChoices,
  type TurnSetup,
  type TurnSetupChoices,
} from '@/domains/sessions/renderer/composer/turn-setup/turn-setup'
import { HarnessLogo } from '@/domains/sessions/renderer/harness/harness-logo'
import { HarnessTabs } from '@/domains/sessions/renderer/harness/harness-tabs'
import { HARNESSES, type HarnessControl } from '@/domains/sessions/renderer/harness/harnesses'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/platform/renderer/components/ui/popover'

export type TurnSetupControlProps = {
  choices: TurnSetupChoices
  value: TurnSetup
  onChange: (setup: TurnSetup) => void
}

type RunSetupMenuProps = { harness: HarnessControl; setup: TurnSetupControlProps | null }

export function RunSetupMenu({ harness, setup }: RunSetupMenuProps) {
  const { t } = useTranslation('sessions')
  const harnessLabel = HARNESSES[harness.harness].label
  const facts = setupFacts(setup)
  const body = <SetupBody harness={harness} setup={setup} />
  return (
    <Popover>
      <PopoverTrigger
        render={
          <InputGroupButton
            variant="ghost"
            className="max-w-80 min-w-0 type-control text-foreground"
            aria-label={`Choose run setup: ${[harnessLabel, ...facts].join(', ')}`}
          />
        }
      >
        <HarnessLogo harness={harness.harness} />
        <span className="min-w-0 truncate">
          {/* The logo names the harness, so its word only shows when there's no Model and Effort to say instead. */}
          {facts.length === 0 ? <span>{harnessLabel}</span> : null}
          {facts.map((fact, index) => (
            <Fragment key={fact}>
              {index > 0 ? <span className="mx-1.5 text-muted-foreground">·</span> : null}
              <span>{fact}</span>
            </Fragment>
          ))}
        </span>
        <Icon name="chevron-down" className="hidden text-muted-foreground @[36rem]:block" />
      </PopoverTrigger>
      <PopoverContent
        aria-label={t('composer.setup.title')}
        align="start"
        side="top"
        className="w-(--size-session-menu) gap-0 overflow-hidden p-0"
      >
        <HarnessTabs harness={harness.harness} onChange={harness.onChange}>
          {body}
        </HarnessTabs>
      </PopoverContent>
    </Popover>
  )
}

function setupFacts(setup: TurnSetupControlProps | null) {
  if (setup === null) return []
  const { choices, value } = setup
  return [choiceLabel(choices, 'model', value.model), choiceLabel(choices, 'effort', value.effort)]
}

// A harness that declares no choices runs at its own configured ones.
function SetupBody({ harness, setup }: RunSetupMenuProps) {
  const { t } = useTranslation('sessions')
  if (setup === null)
    return (
      <p className="p-3.5 type-meta text-muted-foreground">
        {t('composer.setup.ownSettings', { harness: HARNESSES[harness.harness].label })}
      </p>
    )
  return (
    <>
      <ModelOptions {...setup} />
      <EffortSlider {...setup} />
    </>
  )
}

function ModelOptions({ choices, value, onChange }: TurnSetupControlProps) {
  const { t } = useTranslation('sessions')
  const name = useId()
  return (
    <div className="p-2.5">
      <div className="px-1 pb-1.5 type-meta font-medium text-muted-foreground">
        {t('composer.setup.model')}
      </div>
      <div className="space-y-0.5" role="radiogroup" aria-label={t('composer.setup.model')}>
        {choices.models.map((model) => {
          const active = value.model === model.value
          return (
            // A native radio group: arrows move both focus and the choice, and only the checked one is a Tab stop.
            <label
              key={model.value}
              className={`flex min-h-12 w-full cursor-pointer items-center rounded-md px-2.5 py-1.5 text-left transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${
                active ? 'bg-foreground text-background' : 'hover:bg-muted'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={model.value}
                checked={active}
                onChange={() => {
                  const efforts = effortChoices(choices, model.value)
                  onChange({
                    ...value,
                    model: model.value,
                    effort: efforts.some((effort) => effort.value === value.effort)
                      ? value.effort
                      : (efforts[0]?.value ?? value.effort),
                  })
                }}
                className="sr-only"
              />
              <span className="min-w-0">
                <span className="block type-heading">{model.label}</span>
                {model.detail ? (
                  <span
                    className={`mt-0.5 block type-meta ${active ? 'text-background/65' : 'text-muted-foreground'}`}
                  >
                    {model.detail}
                  </span>
                ) : null}
              </span>
              {active ? <Icon name="confirmed" className="ml-auto size-4" /> : null}
            </label>
          )
        })}
      </div>
    </div>
  )
}
