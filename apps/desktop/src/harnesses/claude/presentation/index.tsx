import type { HarnessPresentation } from '@/harnesses/harness-presentation'
import { ClaudeContextComposition } from './claude-context-composition'
import claudeSpark from './claude-spark.svg?url'

function ClaudeLogo() {
  return <img aria-hidden="true" alt="" className="size-3.5 shrink-0" src={claudeSpark} />
}

export const claudePresentation: HarnessPresentation = {
  Logo: ClaudeLogo,
  ContextDetails: ClaudeContextComposition,
  planUsage: [
    { detail: 'Resets in 4 hr 5 min', label: '5-hour limit', percentage: 8 },
    { detail: 'Resets Saturday at 6:00 PM', label: 'Weekly, all models', percentage: 65 },
    { detail: 'Resets Saturday at 6:00 PM', label: 'Weekly, Opus', percentage: 12 },
  ],
  // Claude's gate keeps a standing allow as a rule for similar calls.
  standingAllow: 'similar-calls',
  permissionPlugin: true,
}
export { default as claudeSparkUrl } from './claude-spark.svg?url'
