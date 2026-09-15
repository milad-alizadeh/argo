import { feedScroll } from './feed-scroll'
import type { Scenario } from './scenario'

export const SCENARIOS: Record<string, Scenario> = {
  'feed-scroll': feedScroll,
}
