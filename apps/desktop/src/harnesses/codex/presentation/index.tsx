import { cn } from 'cn'
import type { HarnessPresentation } from '@/harnesses/harness-presentation'
import { harnessLogoRecipe } from '@/harnesses/presentation-logo-recipe'
import { CodexAutoCompact } from './codex-auto-compact'
import codexBlack from './codex-black.svg?url'
import codexWhite from './codex-white.svg?url'

// The original mark fills about 67% of its viewBox, so 1.49 matches the other Harness logos.
function CodexLogo() {
  return (
    <>
      <img
        aria-hidden="true"
        alt=""
        className={cn(harnessLogoRecipe, 'scale-[1.49] dark:hidden')}
        src={codexBlack}
      />
      <img
        aria-hidden="true"
        alt=""
        className={cn(harnessLogoRecipe, 'hidden scale-[1.49] dark:block')}
        src={codexWhite}
      />
    </>
  )
}

export const codexPresentation: HarnessPresentation = {
  Logo: CodexLogo,
  ContextDetails: CodexAutoCompact,
  planUsage: [
    { detail: 'Resets Monday at 9:00 AM', label: 'Weekly', percentage: 54 },
    { detail: 'Resets October 1', label: 'Monthly', percentage: 31 },
  ],
  standingAllow: 'session',
  permissionPlugin: false,
}
