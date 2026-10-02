export const statusToneRecipe = {
  success: 'bg-status-success/15 text-status-success',
  warning: 'bg-warning-subtle text-warning-foreground',
  danger: 'bg-status-danger/15 text-status-danger dark:bg-status-danger/5',
  neutral: 'bg-status-neutral/15 text-status-neutral',
} as const

export const indicatorToneRecipe = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-danger-indicator',
  neutral: 'text-status-neutral',
} as const

export const dangerActionRecipe =
  'border-status-danger text-status-danger hover:bg-status-danger/5 hover:text-status-danger focus-visible:border-status-danger focus-visible:ring-status-danger/50'
