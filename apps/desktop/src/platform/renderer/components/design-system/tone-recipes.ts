export const filledToneRecipe = {
  active: 'bg-active-surface text-active-foreground',
  neutral: 'bg-neutral-surface text-neutral-foreground',
} as const

export const subtleToneRecipe = {
  warning: 'bg-warning-subtle text-warning-foreground',
} as const

export const indicatorToneRecipe = {
  active: 'text-active-indicator',
  success: 'text-success-indicator',
  warning: 'text-warning-indicator',
  danger: 'text-danger-indicator',
  complete: 'text-complete-indicator',
  neutral: 'text-neutral-indicator',
} as const
