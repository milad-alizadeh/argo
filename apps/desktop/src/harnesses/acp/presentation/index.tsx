import { claudeSparkUrl } from '@/harnesses/claude/presentation'
import type { HarnessPresentation } from '@/harnesses/harness-presentation'
import { harnessLogoRecipe } from '@/harnesses/presentation-logo-recipe'
import { Icon } from '@/platform/renderer/components/icon/icon'
import type { AcpAgentEntry, AcpIcon } from '../acp-agents'

const ICON_URLS: Record<AcpIcon, string> = { claude: claudeSparkUrl }

// An agent without a bundled mark draws the shared one; its name beside the mark tells it apart.
function acpLogo(icon: AcpIcon | undefined) {
  if (icon === undefined) return () => <Icon name="agent" className={harnessLogoRecipe} />
  const source = ICON_URLS[icon]
  return () => <img aria-hidden="true" alt="" className={harnessLogoRecipe} src={source} />
}

export function acpPresentation(agent: AcpAgentEntry): HarnessPresentation {
  return {
    Logo: acpLogo(agent.icon),
    planUsage: [],
    // ACP's allow_always option lasts for the Session.
    standingAllow: 'session',
    permissionPlugin: false,
  }
}
