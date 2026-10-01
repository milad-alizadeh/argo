import { i18n } from '@/platform/renderer/i18n/i18n'
import { byAcpAgent } from './acp/acp-agents'
import { acpPresentation } from './acp/acp-presentation'
import { claudePresentation } from './claude/presentation'
import { codexPresentation } from './codex/presentation'
import type { Harness } from './harness'
import type { HarnessPresentation } from './harness-presentation'

export const HARNESS_PRESENTATIONS: Record<Harness, HarnessPresentation> = {
  claude: claudePresentation,
  codex: codexPresentation,
  ...byAcpAgent(() => acpPresentation),
}

// The product name every surface uses; a sign-in row uses the short one.
export function harnessLabel(harness: Harness): string {
  return i18n.t(`harnesses:${harness}.label`)
}

export function harnessShortLabel(harness: Harness): string {
  return i18n.t(`harnesses:${harness}.shortLabel`)
}
