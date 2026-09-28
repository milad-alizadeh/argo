import { HARNESS_PRESENTATIONS } from '@/harnesses/presentation-registry'
import type { SessionHarness } from './harnesses'

export function HarnessLogo({ harness }: { harness: SessionHarness }) {
  const { Logo } = HARNESS_PRESENTATIONS[harness]
  return <Logo />
}
