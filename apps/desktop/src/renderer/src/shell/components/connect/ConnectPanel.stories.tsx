import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  CONNECT_INPUT_BY_STATE as BY_STATE,
  FIXTURE_FOLDER as FOLDER,
  connectPanel as panel,
} from '../../connect/__fixtures__/connectPanel'
import { CONNECT_STATES } from '../../connect/connectPanelModel'
import { ConnectPanel } from './ConnectPanel'

const meta = {
  title: 'Shell/ConnectPanel',
  component: ConnectPanel,
  args: {
    panel: panel({}),
    handlers: {
      onContinue: fn(),
      onRowAct: fn(),
      onChooseCli: fn(),
      onCommit: fn(),
      onContinueOffline: fn(),
    },
  },
  argTypes: {
    panel: { control: 'object', table: { type: { summary: 'ConnectPanelModel' } } },
  },
} satisfies Meta<typeof ConnectPanel>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The panel with nothing set yet.
 *
 * Three rows, all offered at once and none of them waiting on another. `Create project` is
 * disabled here for the one reason a project cannot exist: there is no folder to make it from.
 */
export const Fresh: Story = {
  play: async ({ args, canvasElement }) => {
    const panelView = within(canvasElement)
    await expect(panelView.getByRole('button', { name: 'Create project' })).toBeDisabled()
    await userEvent.click(panelView.getByRole('button', { name: 'Sign in to GitHub' }))
    await expect(args.handlers.onRowAct).toHaveBeenCalledWith('connections')
  },
}

/**
 * A folder and nothing else: the observation floor.
 *
 * This is the state the whole flow exists to make reachable. Git is not required and no
 * provider is connected, and the project is already creatable and already usable.
 */
export const FolderOnly: Story = {
  args: { panel: panel(BY_STATE.direct) },
  play: async ({ args, canvasElement }) => {
    const panelView = within(canvasElement)
    await userEvent.click(panelView.getByRole('button', { name: 'Create project' }))
    await expect(args.handlers.onCommit).toHaveBeenCalled()
  },
}

/**
 * A sign-in in flight.
 *
 * The panel waits visibly: the code and the page to enter it on are on screen, because the
 * sign-in does not settle until the user has finished with it at GitHub.
 */
export const Connecting: Story = {
  args: { panel: panel(BY_STATE.connecting) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('WDJB-MJHT')).toBeVisible()
  },
}

/**
 * A grant GitHub has stopped accepting.
 *
 * The reconnect flow is this panel, not a connections screen somewhere else. Continuing offline
 * is a real answer: everything already fetched stays rendered at full fidelity.
 */
export const Refused: Story = {
  args: { panel: panel(BY_STATE.error) },
  play: async ({ args, canvasElement }) => {
    const panelView = within(canvasElement)
    await userEvent.click(panelView.getByRole('button', { name: 'Continue offline' }))
    await expect(args.handlers.onContinueOffline).toHaveBeenCalled()
  },
}

/**
 * Project Settings: the same panel re-entered on a project that already exists.
 *
 * It reads `Done` instead of `Create project` and adds the one thing onboarding has nowhere to
 * put — the agent this project spawns. There is no second settings surface.
 */
export const Settings: Story = {
  args: { panel: panel({ mode: 'settings', folder: FOLDER, grant: 'connected', cli: 'claude' }) },
  play: async ({ args, canvasElement }) => {
    const panelView = within(canvasElement)
    await expect(panelView.getByRole('button', { name: 'Done' })).toBeEnabled()
    await userEvent.click(panelView.getByRole('radio', { name: 'Codex' }))
    await expect(args.handlers.onChooseCli).toHaveBeenCalledWith('codex')
  },
}

/**
 * Every state the panel has, side by side.
 *
 * The gallery is generated from the state list itself, so a state added to the model without a
 * rendering shows up here as an empty frame rather than as nothing at all.
 */
export const AllStates: Story = {
  render: (args) => (
    <div className="flex flex-col gap-region">
      {CONNECT_STATES.map((state) => (
        <ConnectPanel key={state} panel={panel(BY_STATE[state])} handlers={args.handlers} />
      ))}
    </div>
  ),
}
