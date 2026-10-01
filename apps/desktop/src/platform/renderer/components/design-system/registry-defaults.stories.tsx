import type { Meta, StoryObj } from '@storybook/react-vite'
import { ButtonSpecimen, InputSpecimen } from '@/mocks/styling/controls'
import { playButtons, playInputs } from '@/mocks/styling/controls-play'

const meta = {
  title: 'Components/StylingFoundation/RegistryDefaults',
  parameters: { layout: 'padded' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Buttons: Story = {
  render: () => <ButtonSpecimen />,
  play: playButtons,
}
export const Inputs: Story = {
  render: () => <InputSpecimen />,
  play: playInputs,
}
