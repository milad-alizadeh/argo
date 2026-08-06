import type { DeviceCodePrompt } from '@shared'
import { ArrowSquareOutIcon, Text } from '@/shared/components/ui'

/**
 * Molecule: the code to type and where to type it, while a device-flow sign-in is in flight.
 *
 * The panel waits VISIBLY (#165): the code reaches the screen the moment GitHub issues it,
 * because the sign-in does not settle until the user has finished with it at the browser. A
 * spinner alone would leave them holding a step they were never told about.
 */
export function DeviceCode({
  prompt,
}: {
  /** The code GitHub issued, and the page it is entered on. */
  prompt: DeviceCodePrompt
}): React.JSX.Element {
  return (
    <div
      data-component="DeviceCode"
      className="inset-lip flex flex-col gap-gap rounded-lg bg-inset p-inset"
    >
      <Text variant="meta" as="p" className="text-foreground-soft">
        Enter this code at GitHub to finish signing in. This panel is waiting for you.
      </Text>
      <Text variant="display" as="p" className="text-foreground-bright tracking-widest">
        {prompt.userCode}
      </Text>
      <a
        href={prompt.verificationUri}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-snug text-primary"
      >
        <Text variant="meta">{prompt.verificationUri}</Text>
        <ArrowSquareOutIcon className="icon-sm" />
      </a>
    </div>
  )
}
