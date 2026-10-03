export const statusToneRecipe = {
  success: 'bg-status-success/15 text-status-success',
  warning: 'bg-warning-subtle text-warning-foreground',
  danger: 'bg-status-danger/15 text-status-danger dark:bg-status-danger/5',
  neutral: 'bg-muted text-foreground',
} as const

export const indicatorToneRecipe = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  neutral: 'text-muted-foreground',
} as const

export const dangerActionRecipe =
  'border-status-danger text-status-danger hover:bg-status-danger/5 hover:text-status-danger focus-visible:border-status-danger focus-visible:ring-status-danger/50'

export const noticeToneRecipe = {
  neutral: 'border-border bg-card text-card-foreground',
  success: 'border-status-success/30 bg-card text-status-success',
  warning: 'border-warning-foreground/30 bg-warning-subtle text-warning-foreground',
  danger: 'border-status-danger/30 bg-card text-status-danger',
} as const
