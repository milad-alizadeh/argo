import type { ReactNode } from 'react'

type RangeFieldProps = {
  labelId: string
  label: ReactNode
  description?: ReactNode
  className?: string
  children: ReactNode
}

export function RangeField({ labelId, label, description, className, children }: RangeFieldProps) {
  return (
    <div className={className} data-slot="range-field">
      <div className="flex items-center justify-between gap-3">
        <span id={labelId}>{label}</span>
        {description}
      </div>
      {children}
    </div>
  )
}
