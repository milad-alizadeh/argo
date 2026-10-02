import { Fragment, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { harnessLabel } from '@/harnesses/presentation-registry'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/platform/renderer/components/ui/popover'
import type { HarnessControl } from '../../harness'
import { HarnessLogo, HarnessTabs } from '../../harness'
import {
  choiceLabel,
  effortChoices,
  modeChoices,
  type TurnConfiguration,
  type TurnConfigurationChoices,
} from '../turn-configuration/turn-configuration'
import { ChoiceRow } from './choice-row'
import {
  composerMenuPopupRecipe,
  composerMenuTriggerRecipe,
  composerRichOptionRecipe,
} from './composer-menu-recipes'
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

export type CatalogFailure =
  | { reason: 'not-installed'; installStep: string }
  | {
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
  const label = harnessLabel(harness.harness)
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
    <Popover
      // Every open reads again after an unexplained failure; a person asked, so no bound applies.
      onOpenChange={(open) => {
        if (open && catalogFailure?.reason === 'unavailable') refreshCatalog?.()
      }}
    >
      <PopoverTrigger
        render={
          <InputGroupButton
            variant="ghost"
            className={composerMenuTriggerRecipe('max-w-80 min-w-0')}
            aria-label={`Choose Turn configuration: ${[label, ...facts].join(', ')}`}
          />
        }
      >
        <HarnessLogo harness={harness.harness} />
        <span className="min-w-0 truncate">
          {/* The logo names the harness, so its word only shows when there's no Model and Effort to say instead. */}
          {facts.length === 0 ? <span>{label}</span> : null}
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
        className={composerMenuPopupRecipe(
          'max-h-[min(var(--size-session-menu-max-height),var(--available-height))] gap-0 overflow-hidden p-0 **:data-[slot=tabs]:min-h-0 **:data-[slot=tabs-content]:flex **:data-[slot=tabs-content]:min-h-0 **:data-[slot=tabs-content]:flex-col',
        )}
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
            harness: harnessLabel(harness.harness),
          })}
        </p>
        {'installStep' in catalogFailure ? (
          <p className="type-meta text-muted-foreground">{catalogFailure.installStep}</p>
        ) : null}
        <Button onClick={refreshCatalog} size="sm" type="button" variant="outline">
          {t('composer.turnConfiguration.refreshModels')}
        </Button>
      </div>
    )
  if (turnConfiguration === null)
    return (
      <p className="p-3.5 type-meta text-muted-foreground" role="status">
        {t('composer.turnConfiguration.loadingModels', {
          harness: harnessLabel(harness.harness),
        })}
      </p>
    )
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ModelOptions {...turnConfiguration} />
      </div>
      <div className="shrink-0">
        <EffortSlider {...turnConfiguration} />
      </div>
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
            <ChoiceRow
              key={model.value}
              selected={active}
              htmlFor={`${name}-${model.value}`}
              onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'nearest' })}
            >
              <input
                id={`${name}-${model.value}`}
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
              <span className={composerRichOptionRecipe.content}>
                <span className={composerRichOptionRecipe.label}>{model.label}</span>
                {model.detail ? (
                  <span
                    className={`${composerRichOptionRecipe.detail} ${active ? 'text-background/80' : 'text-muted-foreground'}`}
                  >
                    {model.detail}
                  </span>
                ) : null}
              </span>
              {active ? <Icon name="confirmed" className="ml-auto size-4" /> : null}
            </ChoiceRow>
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
