import type { Meta, StoryObj } from '@storybook/react'
import { ComposerChip, type ComposerChipDefinition } from './ComposerChip'

const SKILL_CHIP: ComposerChipDefinition = { kind: 'skill', label: 'Implement', text: '/implement' }
const PLUGIN_CHIP: ComposerChipDefinition = { kind: 'plugin', label: 'GitHub', text: '@github' }
const FILE_CHIP: ComposerChipDefinition = {
  kind: 'filepath',
  label: 'ComposerPrototype.tsx',
  text: 'apps/desktop/src/renderer/modules/composer-prototype/ComposerPrototype.tsx',
}

const meta: Meta<typeof ComposerChip> = {
  title: 'Composer/ComposerChip',
  component: ComposerChip,
  parameters: { layout: 'centered' },
  args: { chip: SKILL_CHIP },
}

export default meta
type Story = StoryObj<typeof ComposerChip>

export const AllKinds: Story = {
  render: () => (
    <div className="max-w-xl text-foreground type-prose">
      <ComposerChip chip={SKILL_CHIP} /> composer chips with <ComposerChip chip={PLUGIN_CHIP} /> and{' '}
      <ComposerChip chip={FILE_CHIP} />
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
