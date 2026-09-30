import type { Harness } from '@/harnesses/harness'

// Only a Session not yet started can change the harness it runs on.
export type HarnessControl = {
  harness: Harness
  onChange?: (harness: Harness) => void
}
