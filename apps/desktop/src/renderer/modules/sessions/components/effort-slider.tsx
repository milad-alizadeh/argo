import { effortChoices } from '../turn-setup/turn-setup'
import type { TurnSetupControlProps } from './run-setup-menu'

// The end labels sit inside the track; the rest centre on their stop.
function labelShift(index: number, last: number) {
  if (index === 0) return 'none'
  if (index === last) return 'translateX(-100%)'
  return 'translateX(-50%)'
}

export function EffortSlider({ choices, value, onChange }: TurnSetupControlProps) {
  const efforts = effortChoices(choices, value.model)
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
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full border-0 outline-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-(--inset-slider-thumb-lift) [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-foreground focus-visible:[&::-webkit-slider-thumb]:ring-3 focus-visible:[&::-webkit-slider-thumb]:ring-ring/50"
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
