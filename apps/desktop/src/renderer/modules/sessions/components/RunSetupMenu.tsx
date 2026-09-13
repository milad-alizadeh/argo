import { Check, ChevronDown } from 'lucide-react'
import { Fragment, useId } from 'react'

import { InputGroupButton } from '../../../components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover'
import { HarnessLogo } from '../harness/HarnessLogo'
import { HarnessTabs } from '../harness/HarnessTabs'
import { HARNESSES, type HarnessControl } from '../harness/harnesses'
import { choiceLabel, type TurnSetup, type TurnSetupChoices } from '../turn-setup/turn-setup'
import { EffortSlider } from './EffortSlider'

export type TurnSetupControlProps = {
  choices: TurnSetupChoices
  value: TurnSetup
  onChange: (setup: TurnSetup) => void
}

type RunSetupMenuProps = { harness: HarnessControl; setup: TurnSetupControlProps | null }

const WIDE_ONLY = 'hidden @[36rem]:inline'

// Extracted from the composer prototype (602bcce2).
export function RunSetupMenu({ harness, setup }: RunSetupMenuProps) {
  const harnessLabel = HARNESSES[harness.cli].label
  const facts = setupFacts(setup)
  const body = <SetupBody harness={harness} setup={setup} />
  return (
    <Popover>
      <PopoverTrigger
        render={
          <InputGroupButton
            variant="ghost"
            className="max-w-80 min-w-0 type-label font-medium text-foreground"
            aria-label={`Choose run setup: ${[harnessLabel, ...facts].join(', ')}`}
          />
        }
      >
        <HarnessLogo cli={harness.cli} />
        <span className="min-w-0 truncate">
          {/* The logo names the harness, so its word waits for room; the Model and Effort never do. */}
          <span className={WIDE_ONLY}>{harnessLabel}</span>
          {facts.map((fact, index) => (
            <Fragment key={fact}>
              <span className={`mx-1.5 text-muted-foreground ${index === 0 ? WIDE_ONLY : ''}`}>
                ·
              </span>
              <span>{fact}</span>
            </Fragment>
          ))}
        </span>
        <ChevronDown className="hidden text-muted-foreground @[36rem]:block" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[23rem] gap-0 overflow-hidden p-0">
        <HarnessTabs cli={harness.cli} onChange={harness.onChange}>
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
  if (setup === null)
    return (
      <p className="p-3.5 type-meta text-muted-foreground">
        {HARNESSES[harness.cli].label} runs at the Model and Effort in its own settings.
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
  const name = useId()
  return (
    <div className="p-2.5">
      <div className="px-1 pb-1.5 type-meta font-medium text-muted-foreground">Model</div>
      <div className="space-y-0.5" role="radiogroup" aria-label="Model">
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
                onChange={() => onChange({ ...value, model: model.value })}
                className="sr-only"
              />
              <span className="min-w-0">
                <span className="block type-heading font-medium">{model.label}</span>
                {model.detail ? (
                  <span
                    className={`mt-0.5 block type-meta ${active ? 'text-background/65' : 'text-muted-foreground'}`}
                  >
                    {model.detail}
                  </span>
                ) : null}
              </span>
              {active ? <Check className="ml-auto size-4" /> : null}
            </label>
          )
        })}
      </div>
    </div>
  )
}
