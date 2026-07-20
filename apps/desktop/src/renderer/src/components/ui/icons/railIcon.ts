import type { RailIcon } from '@/ship'
import { ArrowLineUpIcon } from './ArrowLineUpIcon'
import { CheckIcon } from './CheckIcon'
import { CircleIcon } from './CircleIcon'
import { CircleNotchIcon } from './CircleNotchIcon'
import type { IconAtom } from './createIcon'
import { GearIcon } from './GearIcon'
import { GitCommitIcon } from './GitCommitIcon'
import { GitMergeIcon } from './GitMergeIcon'
import { GitPullRequestIcon } from './GitPullRequestIcon'
import { ProhibitIcon } from './ProhibitIcon'
import { UserIcon } from './UserIcon'
import { WarningIcon } from './WarningIcon'
import { XIcon } from './XIcon'

// Name → atom, and nothing else: which icon a state wears is the ship derivation's call
// (`RailStatus.icon`), so this side only knows how to draw the name it is handed.
export const RAIL_ICON: Record<RailIcon, IconAtom> = {
  'arrow-line-up': ArrowLineUpIcon,
  check: CheckIcon,
  circle: CircleIcon,
  'circle-notch': CircleNotchIcon,
  gear: GearIcon,
  'git-commit': GitCommitIcon,
  'git-merge': GitMergeIcon,
  'git-pull-request': GitPullRequestIcon,
  prohibit: ProhibitIcon,
  user: UserIcon,
  warning: WarningIcon,
  x: XIcon,
}
