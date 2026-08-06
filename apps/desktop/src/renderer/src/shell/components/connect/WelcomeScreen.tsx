import {
  BinocularsIcon,
  Button,
  GitPullRequestIcon,
  type IconAtom,
  TerminalWindowIcon,
  Text,
} from '@/shared/components/ui'
import { BenefitRow } from './BenefitRow'

// Three lines, in the order a day runs: see what is happening, act on it, then ship it. No
// feature grid and no tier ladder (#165) — the screen teaches what Argo is FOR, and every
// word of it is answerable before anything is connected.
const BENEFITS: { icon: IconAtom; title: string; detail: string }[] = [
  {
    icon: BinocularsIcon,
    title: 'See every agent at once',
    detail:
      'Each coding session you have running, what it is doing right now, and which one is waiting on you.',
  },
  {
    icon: TerminalWindowIcon,
    title: 'Steer without switching windows',
    detail: 'Type straight at any agent, read its files and run commands, all in one place.',
  },
  {
    icon: GitPullRequestIcon,
    title: 'Follow the work to shipped',
    detail: 'Your tickets, branches, pull requests and their checks, next to the agent doing them.',
  },
]

/**
 * Organism: the first screen, before Argo asks for anything.
 *
 * It is a screen rather than a step: nothing is gated behind it and it never comes back once
 * passed. Onboarding IS creating a Project (ADR-0015), so what follows is the project-setup
 * panel and not a wizard with pages to count.
 */
export function WelcomeScreen({
  onContinue,
}: {
  /** Move on to the Connect panel. */
  onContinue: () => void
}): React.JSX.Element {
  return (
    <div
      data-component="WelcomeScreen"
      className="flex w-full max-w-prose flex-col gap-region px-region"
    >
      <div className="flex flex-col gap-gap">
        <Text variant="display" as="h1" className="text-foreground-bright">
          Welcome to Argo
        </Text>
        <Text variant="prose" as="p" className="text-foreground-soft">
          Argo is a window onto the coding agents you already run.
        </Text>
      </div>
      <div className="flex flex-col gap-inset">
        {BENEFITS.map((benefit) => (
          <BenefitRow key={benefit.title} {...benefit} />
        ))}
      </div>
      <div className="flex">
        <Button variant="primary" onClick={onContinue}>
          Get started
        </Button>
      </div>
    </div>
  )
}
