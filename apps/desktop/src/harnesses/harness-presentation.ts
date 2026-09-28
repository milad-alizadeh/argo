import type { ComponentType } from 'react'

// How the renderer draws one Harness; shared screens read it by Harness ID and never branch on one.
export type HarnessPresentation = {
  // Decorative: the Harness's name always sits beside it or in its control's accessible name.
  Logo: ComponentType
  // Drawn under the shared context window details when the Harness has more to show.
  ContextDetails?: ComponentType<{ capacityTokens: number | null }>
  planUsage: readonly { detail: string; label: string; percentage: number }[]
  // What a Permission's standing allow covers.
  standingAllow: 'similar-calls' | 'session'
  // Whether the composer can reference the live Argo permission plugin.
  permissionPlugin: boolean
}
