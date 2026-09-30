import type { Harness } from '@/harnesses/harness'
import { HARNESS_PRESENTATIONS } from '@/harnesses/presentation-registry'

export function HarnessLogo({ harness }: { harness: Harness }) {
  const { Logo } = HARNESS_PRESENTATIONS[harness]
  return <Logo />
}
