import { indicatorToneRecipe } from '@/platform/renderer/components/design-system/tone-recipes'
import type { WorkState } from './work/presentation'

export type SessionStatusVariant = 'active' | 'attention' | 'failed' | 'idle' | 'unknown'

const stateIndicatorRecipe = {
  success: `${indicatorToneRecipe.success} bg-current`,
  warning: `${indicatorToneRecipe.warning} bg-current`,
  danger: `${indicatorToneRecipe.danger} bg-current`,
  neutral: `${indicatorToneRecipe.neutral} bg-current`,
} as const

const attentionMotionRecipe = 'animate-[status-light-blink_1.6s_ease-in-out_infinite]'
const attentionGlowRecipe = 'shadow-[0_0_5px_color-mix(in_srgb,currentColor_35%,transparent)]'

export const sessionStatusMarkRecipe = {
  active: `${stateIndicatorRecipe.success} shadow-state-glow ${attentionMotionRecipe}`,
  attention: `${stateIndicatorRecipe.warning} ${attentionGlowRecipe} ${attentionMotionRecipe}`,
  failed: stateIndicatorRecipe.danger,
  idle: stateIndicatorRecipe.neutral,
  unknown: 'bg-transparent shadow-state-outline',
} satisfies Record<SessionStatusVariant, string>

export const workStateMarkRecipe = {
  running: `${stateIndicatorRecipe.success} shadow-state-glow`,
  done: stateIndicatorRecipe.success,
  completed: stateIndicatorRecipe.success,
  failed: stateIndicatorRecipe.danger,
  interrupted: stateIndicatorRecipe.warning,
  unknown: stateIndicatorRecipe.neutral,
} satisfies Record<WorkState, string>
