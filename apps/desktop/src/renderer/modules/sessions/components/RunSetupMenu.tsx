import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'

import { InputGroupButton } from '../../../components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover'
import { choiceLabel, type TurnSetup, type TurnSetupChoices } from '../turn-setup/turn-setup'

export type TurnSetupControlProps = {
  choices: TurnSetupChoices
  value: TurnSetup
  onChange: (setup: TurnSetup) => void
}

// Extracted from the composer prototype (602bcce2); the harness tabs stay with ComposerCliToggle.
export function RunSetupMenu({ choices, value, onChange }: TurnSetupControlProps) {
  const model = choiceLabel(choices, 'model', value.model)
  const effort = choiceLabel(choices, 'effort', value.effort)
  return (
    <Popover>
      <PopoverTrigger
        render={
          <InputGroupButton
            variant="ghost"
            className="max-w-80 shrink-0 type-label font-medium text-foreground"
            aria-label={`Choose run setup: ${choices.label}, ${model}, ${effort}`}
          />
        }
      >
        <SlidersHorizontal className="size-3.5" />
        <span className="hidden items-center gap-1.5 @[36rem]:inline-flex">
          {choices.label}
          <span className="text-muted-foreground">·</span>
          {model}
          <span className="text-muted-foreground">·</span>
          {effort}
        </span>
        <ChevronDown className="hidden text-muted-foreground @[36rem]:block" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[23rem] gap-0 overflow-hidden p-0">
        <ModelOptions choices={choices} value={value} onChange={onChange} />
        <EffortSlider choices={choices} value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
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

// The end labels sit inside the track; the rest centre on their stop.
function labelShift(index: number, last: number) {
  if (index === 0) return 'none'
  if (index === last) return 'translateX(-100%)'
  return 'translateX(-50%)'
}

function EffortSlider({ choices, value, onChange }: TurnSetupControlProps) {
  const efforts = choices.efforts
  const effortIndex = Math.max(
    0,
    efforts.findIndex((effort) => effort.value === value.effort),
  )
  const lastEffort = Math.max(1, efforts.length - 1)
  const effortPercent = (effortIndex / lastEffort) * 100
  return (
    <div className="border-t p-2.5">
      <div className="flex items-center">
        <div className="type-label font-medium text-muted-foreground">Effort</div>
        <span className="ml-auto type-meta text-muted-foreground">
          More effort trades speed for deeper reasoning.
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, efforts.length - 1)}
        step={1}
        value={effortIndex}
        aria-label="Effort"
        aria-valuetext={efforts[effortIndex]?.label}
        onChange={(event) => {
          const effort = efforts[Number(event.currentTarget.value)]
          if (effort) onChange({ ...value, effort: effort.value })
        }}
        style={{
          background: `linear-gradient(to right, var(--foreground) 0%, var(--foreground) ${effortPercent}%, var(--muted) ${effortPercent}%, var(--muted) 100%)`,
        }}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full border-0 outline-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-foreground focus-visible:[&::-webkit-slider-thumb]:ring-3 focus-visible:[&::-webkit-slider-thumb]:ring-ring/50"
      />
      <div className="relative mt-2 h-4 type-meta text-muted-foreground">
        {efforts.map((effort, index) => (
          <span
            key={effort.value}
            className={`absolute whitespace-nowrap ${value.effort === effort.value ? 'font-semibold text-foreground' : ''}`}
            style={{
              left: `${(index / lastEffort) * 100}%`,
              transform: labelShift(index, efforts.length - 1),
            }}
          >
            {effort.label}
          </span>
        ))}
      </div>
    </div>
  )
}
