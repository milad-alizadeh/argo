import { Fragment, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/platform/renderer/components/ui/popover'
import { HarnessLogo } from '../../harness/harness-logo'
import { HarnessTabs } from '../../harness/harness-tabs'
import { HARNESSES, type HarnessControl } from '../../harness/harnesses'
import {
  choiceLabel,
  effortChoices,
  modeChoices,
  type TurnConfiguration,
  type TurnConfigurationChoices,
} from '../turn-configuration/turn-configuration'
import { EffortSlider } from './effort-slider'

export type TurnConfigurationControlProps = {
  choices: TurnConfigurationChoices
  value: TurnConfiguration
  onChange: (turnConfiguration: TurnConfiguration) => void
}

type TurnConfigurationMenuProps = {
  harness: HarnessControl
  turnConfiguration: TurnConfigurationControlProps | null
  catalogFailure?: CatalogFailure | null
  refreshCatalog?: () => void
}

export type CatalogFailure = {
  reason: 'not-installed' | 'not-signed-in' | 'invalid-response' | 'unavailable' | 'load-failed'
  detail?: string
}

export function TurnConfigurationMenu({
  harness,
  turnConfiguration,
  catalogFailure = null,
  refreshCatalog,
}: TurnConfigurationMenuProps) {
  const { t } = useTranslation('sessions')
  const harnessLabel = HARNESSES[harness.harness].label
  const facts = configurationFacts(turnConfiguration)
  const body = (
    <ConfigurationBody
      harness={harness}
      turnConfiguration={turnConfiguration}
      catalogFailure={catalogFailure}
      refreshCatalog={refreshCatalog}
    />
  )
  return (
    <Popover>
      <PopoverTrigger
        render={
          <InputGroupButton
            variant="ghost"
            className="max-w-80 min-w-0 type-control text-foreground"
            aria-label={`Choose Turn configuration: ${[harnessLabel, ...facts].join(', ')}`}
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
        aria-label={t('composer.turnConfiguration.title')}
        align="start"
        side="top"
        tabIndex={0}
        className="max-h-(--size-session-menu-max-height) w-(--size-session-menu) gap-0 overflow-y-auto p-0"
      >
        <HarnessTabs harness={harness.harness} onChange={harness.onChange}>
          {body}
        </HarnessTabs>
      </PopoverContent>
    </Popover>
  )
}

function configurationFacts(turnConfiguration: TurnConfigurationControlProps | null) {
  if (turnConfiguration === null) return []
  const { choices, value } = turnConfiguration
  return [
    choiceLabel(choices, { field: 'model', value: value.model }),
    choiceLabel(choices, { field: 'effort', value: value.effort, model: value.model }),
  ]
}

function ConfigurationBody({
  harness,
  turnConfiguration,
  catalogFailure,
  refreshCatalog,
}: TurnConfigurationMenuProps) {
  const { t } = useTranslation('sessions')
  if (catalogFailure)
    return (
      <div className="space-y-2 p-3.5" role="alert">
        <p className="type-meta text-muted-foreground">
          {t(`composer.turnConfiguration.catalogFailure.${catalogFailure.reason}`, {
            harness: HARNESSES[harness.harness].label,
          })}
        </p>
        <Button onClick={refreshCatalog} size="sm" type="button" variant="outline">
          {t('composer.turnConfiguration.refreshModels')}
        </Button>
      </div>
    )
  if (turnConfiguration === null)
    return (
      <p className="p-3.5 type-meta text-muted-foreground" role="status">
        {t('composer.turnConfiguration.loadingModels', {
          harness: HARNESSES[harness.harness].label,
        })}
      </p>
    )
  return (
    <>
      <ModelOptions {...turnConfiguration} />
      <EffortSlider {...turnConfiguration} />
    </>
  )
}

function ModelOptions({ choices, value, onChange }: TurnConfigurationControlProps) {
  const { t } = useTranslation('sessions')
  const name = useId()
  return (
    <div className="p-2.5">
      <div className="px-1 pb-1.5 type-meta font-medium text-muted-foreground">
        {t('composer.turnConfiguration.model')}
      </div>
      <div
        className="space-y-0.5"
        role="radiogroup"
        aria-label={t('composer.turnConfiguration.model')}
      >
        {choices.models.map((model) => {
          const active = value.model === model.value
          return (
            // A native radio group: arrows move both focus and the choice, and only the checked one is a Tab stop.
            <label
              key={model.value}
              className={`flex min-h-12 w-full items-center rounded-md px-2.5 py-1.5 text-left transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${
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
                  const modes = modeChoices(choices, model.value)
                  const currentEffort = efforts.find((effort) => effort.value === value.effort)
                  const currentMode = modes.find((mode) => mode.value === value.mode)
                  const nextEffort = currentEffort ?? closestEffort(value.effort, choices, model)
                  onChange({
                    ...value,
                    model: model.value,
                    effort: nextEffort?.value ?? value.effort,
                    mode: currentMode?.value ?? modes[0]?.value ?? value.mode,
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

function closestEffort(
  current: string,
  choices: TurnConfigurationChoices,
  model: TurnConfigurationChoices['models'][number],
) {
  const order = choices.efforts.map(({ value }) => value)
  const efforts = effortChoices(choices, model.value)
  const currentRank = order.indexOf(current)
  if (currentRank === -1)
    return efforts.find(({ value }) => value === model.defaultEffort) ?? efforts[0]
  return (
    efforts.reduce<(typeof efforts)[number] | undefined>((closest, choice) => {
      const rank = order.indexOf(choice.value)
      if (rank === -1) return closest
      if (
        closest === undefined ||
        Math.abs(rank - currentRank) < Math.abs(order.indexOf(closest.value) - currentRank)
      )
        return choice
      return closest
    }, undefined) ??
    efforts.find(({ value }) => value === model.defaultEffort) ??
    efforts[0]
  )
}
