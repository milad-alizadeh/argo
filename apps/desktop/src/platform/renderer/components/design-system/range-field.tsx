import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { cn } from 'cn'
import type { ReactNode } from 'react'

type RangeFieldProps = {
  labelId: string
  label: ReactNode
  description?: ReactNode
  descriptionId?: string
  className?: string
  children: ReactNode
}

export function RangeField({
  labelId,
  label,
  description,
  descriptionId,
  className,
  children,
}: RangeFieldProps) {
  return (
    <div className={className} data-slot="range-field">
      <div className="flex items-center justify-between gap-3">
        <span id={labelId}>{label}</span>
        {description ? <span id={descriptionId}>{description}</span> : null}
      </div>
      {children}
    </div>
  )
}

type RangeSliderProps = Omit<
  SliderPrimitive.Root.Props<readonly [number]>,
  'children' | 'defaultValue' | 'onValueChange' | 'value'
> & {
  value: number
  onValueChange?: (value: number, eventDetails: SliderPrimitive.Root.ChangeEventDetails) => void
  getAriaValueText?: SliderPrimitive.Thumb.Props['getAriaValueText']
}

export function RangeSlider({
  className,
  value,
  min = 0,
  max = 100,
  onValueChange,
  getAriaValueText,
  'aria-describedby': describedBy,
  ...props
}: RangeSliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn('data-horizontal:w-full data-vertical:h-full', className)}
      data-slot="slider"
      value={[value] as const}
      min={min}
      max={max}
      thumbAlignment="edge"
      onValueChange={(nextValue, eventDetails) => onValueChange?.(nextValue[0], eventDetails)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          index={0}
          aria-describedby={describedBy}
          getAriaValueText={getAriaValueText}
          className="relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
