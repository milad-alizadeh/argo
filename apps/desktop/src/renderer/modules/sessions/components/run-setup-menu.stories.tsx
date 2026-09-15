import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import { HARNESSES, type SessionCli } from '../harness/harnesses'
import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import { RunSetupMenu } from './run-setup-menu'

// A started Session keeps its harness; a new one offers the harness tabs.
function RunSetupStory({ started = true }: { started?: boolean }) {
  const [cli, setCli] = useState<SessionCli>('claude')
  const [setup, setSetup] = useState(CLAUDE_TURN_SETUP.opening)
  const choices = HARNESSES[cli].setup
  const chooseHarness = (nextCli: SessionCli) => {
    setCli(nextCli)
    const nextSetup = HARNESSES[nextCli].setup
    if (nextSetup !== null) setSetup(nextSetup.opening)
  }
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <RunSetupMenu
        harness={started ? { cli } : { cli, onChange: chooseHarness }}
        setup={choices ? { choices, value: setup, onChange: setSetup } : null}
      />
      <output hidden data-testid="chosen-setup">
        {`${cli} ${setup.model} ${setup.effort}`}
      </output>
    </div>
  )
}

const meta: Meta<typeof RunSetupStory> = {
  title: 'Sessions/Composer/Run Setup Menu',
  component: RunSetupStory,
}

export default meta
type Story = StoryObj<typeof RunSetupStory>

const page = () => within(document.body)

const TRIGGER = /^Choose run setup/

export const ChoosesModelAndEffort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await expect(trigger).toHaveTextContent('Claude Code·Opus 5·Medium')
    await expect(trigger).toHaveAccessibleName('Choose run setup: Claude Code, Opus 5, Medium')

    await userEvent.click(trigger)
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    const offered = within(models)
      .getAllByRole('radio')
      .map((option) => option.closest('label')?.textContent)
    await expect(offered).toEqual([
      'Fable 5.1Deepest reasoning for long, open-ended work',
      'Opus 5Most capable for architecture and hard problems',
      'Sonnet 5Balanced for daily coding and review',
      'Haiku 4.5Fast for small changes and quick answers',
    ])
    await userEvent.click(within(models).getByRole('radio', { name: /Sonnet 5/ }))
    await expect(within(models).getByRole('radio', { name: /Sonnet 5/ })).toBeChecked()

    const effort = page().getByRole('slider', { name: 'Effort' })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Medium')
    // user-event cannot step a native range, so the drag lands as the change it produces.
    fireEvent.change(effort, { target: { value: '4' } })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Max')
    fireEvent.change(effort, { target: { value: '3' } })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Extra high')
    const effortScale = effort.parentElement
    if (!effortScale) throw new Error('Effort scale is missing.')
    await expect(within(effortScale).getByText('Extra high')).toHaveClass('font-semibold')
    await expect(canvas.getByTestId('chosen-setup')).toHaveTextContent('claude sonnet xhigh')
    const harnesses = page().getByRole('tablist', { name: 'Harness' })
    for (const label of ['Claude Code', 'Codex']) {
      const tab = within(harnesses).getByRole('tab', { name: label })
      await expect(tab).toHaveAttribute('aria-disabled', 'true')
      await expect(tab).toHaveAttribute('tabindex', '-1')
    }

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Claude Code·Sonnet 5·Extra high')
  },
}

export const ChoosesByKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })

    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    await waitFor(() => expect(within(models).getByRole('radio', { name: /Opus 5/ })).toHaveFocus())

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    const haiku = within(models).getByRole('radio', { name: /Haiku 4.5/ })
    await expect(haiku).toHaveFocus()
    await expect(haiku).toBeChecked()
    await expect(canvas.getByTestId('chosen-setup')).toHaveTextContent('claude haiku medium')
    await userEvent.tab()
    await expect(page().getByRole('slider', { name: 'Effort' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}

export const NewSessionChoosesHarness: Story = {
  args: { started: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })

    await userEvent.click(trigger)
    const harnesses = await page().findByRole('tablist', { name: 'Harness' })
    const claude = within(harnesses).getByRole('tab', { name: 'Claude Code' })
    await waitFor(() => expect(claude).toHaveFocus())
    await expect(claude).toHaveAttribute('aria-selected', 'true')
    // The track pads the active tab on every side (602bcce2); the popover may still be scaling in.
    await expect(harnesses.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(
      claude.getBoundingClientRect().bottom + 3,
    )
    await expect(page().getByRole('tabpanel')).toContainElement(
      page().getByRole('radiogroup', { name: 'Model' }),
    )
    // The panel is no Tab stop of its own: Tab goes from the tab straight to the chosen Model.
    await userEvent.tab()
    await expect(page().getByRole('radio', { name: /Opus 5/ })).toHaveFocus()
    await userEvent.tab({ shift: true })
    await expect(claude).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}{Enter}')
    const codex = within(harnesses).getByRole('tab', { name: 'Codex' })
    await expect(codex).toHaveAttribute('aria-selected', 'true')
    const codexModels = page().getByRole('radiogroup', { name: 'Model' })
    await expect(within(codexModels).getAllByRole('radio')).toHaveLength(5)
    await expect(within(codexModels).getByRole('radio', { name: /Gpt 5.6 Sol/ })).toBeChecked()
    await expect(trigger).toHaveAccessibleName('Choose run setup: Codex, Gpt 5.6 Sol, Low')
    await expect(canvas.getByTestId('chosen-setup')).toHaveTextContent('codex gpt-5.6-sol low')

    await userEvent.click(within(harnesses).getByRole('tab', { name: 'Claude Code' }))
    await expect(page().getByRole('radiogroup', { name: 'Model' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('tablist')).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Claude Code·Opus 5·Medium')
  },
}
