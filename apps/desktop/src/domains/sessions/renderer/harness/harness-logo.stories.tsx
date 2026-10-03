import type { Meta, StoryObj } from '@storybook/react-vite'
import { acpPresentation } from '@/harnesses/acp/presentation'
import { HARNESSES } from '@/harnesses/harness'
import { harnessShortLabel } from '@/harnesses/presentation-registry'
import { HarnessLogo } from './harness-logo'

const { Logo: GenericAcpLogo } = acpPresentation({
  id: 'generic-acp-story',
  label: 'Generic ACP agent',
  command: 'story-agent',
  args: [],
  installStep: 'Story fixture only',
})

const meta = {
  title: 'Features/Sessions/Harness/Logo',
  component: HarnessLogo,
  args: { harness: 'claude' },
  tags: ['view-only'],
} satisfies Meta<typeof HarnessLogo>

export default meta
type Story = StoryObj<typeof meta>

export const LocalIdentityAssets: Story = {
  render: () => (
    <ul aria-label="Harness identity assets" className="grid gap-4">
      {HARNESSES.map((harness) => (
        <li className="flex items-center gap-3" key={harness}>
          <HarnessLogo harness={harness} />
          <span>{harnessShortLabel(harness)}</span>
        </li>
      ))}
      <li className="flex items-center gap-3">
        <GenericAcpLogo />
        <span>Generic ACP fallback</span>
      </li>
    </ul>
  ),
}
