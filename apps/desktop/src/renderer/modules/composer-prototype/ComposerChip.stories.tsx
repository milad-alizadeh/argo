import { FileCode2 } from 'lucide-react'
import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from '@/renderer/components/ui/badge'

type ComposerChipDefinition = {
  kind: 'filepath' | 'plugin' | 'skill'
  label: string
  text: string
}

function ComposerChipSpecimen({ chip }: { chip: ComposerChipDefinition }) {
  return (
    <Badge
      variant="outline"
      className="align-middle text-foreground type-label"
      data-composer-text={chip.text}
    >
      {chip.kind === 'filepath' ? <FileCode2 className="!size-(--size-icon-inline)" /> : null}
      {chip.label}
    </Badge>
  )
}

const SKILL_CHIP: ComposerChipDefinition = { kind: 'skill', label: 'Implement', text: '/implement' }
const PLUGIN_CHIP: ComposerChipDefinition = { kind: 'plugin', label: 'GitHub', text: '@github' }
const FILE_CHIP: ComposerChipDefinition = {
  kind: 'filepath',
  label: 'ComposerPrototype.tsx',
  text: 'apps/desktop/src/renderer/modules/composer-prototype/ComposerPrototype.tsx',
}

const meta: Meta<typeof ComposerChipSpecimen> = {
  title: 'Composer/ComposerChip',
  component: ComposerChipSpecimen,
  parameters: { layout: 'centered' },
  args: { chip: SKILL_CHIP },
}

export default meta
type Story = StoryObj<typeof ComposerChipSpecimen>

export const AllKinds: Story = {
  render: () => (
    <div className="max-w-xl text-foreground type-prose">
      <ComposerChipSpecimen chip={SKILL_CHIP} /> composer chips with <ComposerChipSpecimen chip={PLUGIN_CHIP} /> and{' '}
      <ComposerChipSpecimen chip={FILE_CHIP} />
    </div>
  ),
}

export const Skill: Story = {}

export const Plugin: Story = {
  args: { chip: PLUGIN_CHIP },
}

export const File: Story = {
  args: { chip: FILE_CHIP },
}
