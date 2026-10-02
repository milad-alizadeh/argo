export const statusToneRecipe = {
  success: 'bg-status-success/15 text-status-success',
  warning: 'bg-warning-subtle text-warning-foreground',
  danger: 'bg-status-danger/15 text-status-danger',
  neutral: 'bg-status-neutral/15 text-status-neutral',
} as const

export const indicatorToneRecipe = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-danger-indicator',
  neutral: 'text-status-neutral',
} as const
