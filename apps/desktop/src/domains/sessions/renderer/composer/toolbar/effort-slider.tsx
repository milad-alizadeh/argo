import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { RangeField, RangeSlider } from '@/platform/renderer/components/design-system/range-field'
import { effortChoices } from '../turn-configuration/turn-configuration'
import type { TurnConfigurationControlProps } from './turn-configuration-menu'

// The end labels sit inside the track; the rest centre on their stop.
function labelShift(index: number, last: number) {
  if (index === 0) return 'none'
  if (index === last) return 'translateX(-100%)'
  return 'translateX(-50%)'
}

export function EffortSlider({ choices, value, onChange }: TurnConfigurationControlProps) {
  const { t } = useTranslation('sessions')
  const labelId = useId()
  const descriptionId = useId()
  const selectedEffortId = useId()
  const efforts = effortChoices(choices, value.model)
  const effortIndex = Math.max(
    0,
    efforts.findIndex((effort) => effort.value === value.effort),
  )
  return (
    <RangeField
      labelId={labelId}
      descriptionId={descriptionId}
      className="border-t p-2.5"
      label={
        <span className="type-label font-medium text-muted-foreground">
          {t('composer.turnConfiguration.effort')}
        </span>
      }
      description={
        <span className="type-meta text-muted-foreground">
          {t('composer.turnConfiguration.effortDescription')}
        </span>
      }
    >
      <div className="mt-3">
        <RangeSlider
          aria-labelledby={`${labelId} ${selectedEffortId}`}
          aria-describedby={descriptionId}
          value={effortIndex}
          min={0}
          max={Math.max(1, efforts.length - 1)}
          disabled={efforts.length < 2}
          step={1}
          getAriaValueText={(_formattedValue, index) =>
            efforts[index]?.label ?? t('composer.turnConfiguration.effort')
          }
          onValueChange={(index) => {
            const effort = efforts[index]
            if (effort) onChange({ ...value, effort: effort.value })
          }}
        />
      </div>
      <div className="relative mt-2 h-4 type-meta text-muted-foreground">
        {efforts.map((effort, index) => (
          <span
            key={effort.value}
            id={index === effortIndex ? selectedEffortId : undefined}
            className={`absolute whitespace-nowrap ${index === effortIndex ? 'font-semibold text-foreground' : ''}`}
            style={{
              left: `${(index / Math.max(1, efforts.length - 1)) * 100}%`,
              transform: labelShift(index, efforts.length - 1),
            }}
          >
            {effort.label}
          </span>
        ))}
      </div>
    </RangeField>
  )
}
