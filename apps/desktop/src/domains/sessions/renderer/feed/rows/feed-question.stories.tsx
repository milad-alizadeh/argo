import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { SessionFeedRow } from '../../types'
import { FeedQuestion } from './feed-question'

type AskRow = Extract<SessionFeedRow, { shape: 'ask' }>

const singleSelect: AskRow = {
  shape: 'ask',
  id: 'ask-single',
  answer: null,
  unsupported: null,
  questions: [
    {
      question: 'Which ink should the plotter load?',
      header: 'Ink',
      multiSelect: false,
      options: [
        { label: 'Black', description: 'The default.' },
        { label: 'Sepia', description: null },
      ],
    },
  ],
}

const multiSelect: AskRow = {
  shape: 'ask',
  id: 'ask-multi',
  answer: null,
  unsupported: null,
  questions: [
    {
      question: 'Which checks should the release gate run?',
      header: null,
      multiSelect: true,
      options: [
        { label: 'Typecheck', description: null },
        { label: 'Unit tests', description: null },
        { label: 'Storybook', description: null },
      ],
    },
  ],
}

const meta = {
  title: 'Sessions/Feed/Question',
  component: FeedQuestion,
  args: {
    row: singleSelect,
    answering: false,
    failure: null,
    locked: false,
    onAnswer: fn(),
  },
} satisfies Meta<typeof FeedQuestion>

export default meta
type Story = StoryObj<typeof meta>

export const SingleSelect: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Answer the agent's question")).toBeVisible()
    await expect(canvas.getByText('Which ink should the plotter load?')).toBeInTheDocument()
    const submit = canvas.getByRole('button', { name: 'Send answer' })
    await expect(submit).toBeDisabled()

    await userEvent.click(canvas.getByText('Sepia'))
    await expect(submit).toBeEnabled()
    await userEvent.click(submit)

    await expect(args.onAnswer).toHaveBeenCalledWith('ask-single', [
      { kind: 'options', indices: [2] },
    ])
  },
}

export const KeyboardRoute: Story = {
  args: { row: singleSelect, onAnswer: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const black = canvas.getByRole('radio', { name: /Black/ })
    const sepia = canvas.getByRole('radio', { name: /Sepia/ })

    await userEvent.tab()
    await expect(black).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    await expect(sepia).toHaveFocus()
    await expect(sepia).toBeChecked()

    await userEvent.tab()
    await expect(canvas.getByLabelText('Write another answer')).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Send answer' })).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    await expect(args.onAnswer).toHaveBeenCalledWith('ask-single', [
      { kind: 'options', indices: [2] },
    ])
  },
}

export const MultiSelect: Story = {
  args: { row: multiSelect, onAnswer: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Typecheck'))
    await userEvent.click(canvas.getByText('Storybook'))
    await userEvent.click(canvas.getByRole('button', { name: 'Send answer' }))

    await expect(args.onAnswer).toHaveBeenCalledWith('ask-multi', [
      { kind: 'options', indices: [1, 3] },
    ])
  },
}

export const FreeText: Story = {
  args: { row: singleSelect, onAnswer: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Write another answer'), 'Use whatever is loaded.')
    const submit = canvas.getByRole('button', { name: 'Send answer' })
    await expect(submit).toBeEnabled()
    await userEvent.click(submit)

    await expect(args.onAnswer).toHaveBeenCalledWith('ask-single', [
      { kind: 'text', index: 3, text: 'Use whatever is loaded.' },
    ])
  },
}

export const Answering: Story = {
  args: { answering: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Send answer' })).toBeDisabled()
    await expect(canvas.getByRole('radio', { name: /Black/ })).toBeDisabled()
  },
}

export const Failed: Story = {
  args: { failure: 'Argo could not send this answer.' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Argo could not send this answer.'),
    ).toBeInTheDocument()
  },
}

export const Unsupported: Story = {
  args: {
    row: {
      ...singleSelect,
      unsupported: 'This question asks for a secret value, which Argo cannot show or submit.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('This question asks for a secret value, which Argo cannot show or submit.'),
    ).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Send answer' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('radio')).not.toBeInTheDocument()
  },
}

export const Locked: Story = {
  args: { locked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('This session is open in another app')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Send answer' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('radio')).not.toBeInTheDocument()
  },
}

export const Answered: Story = {
  args: { row: { ...singleSelect, answer: 'Sepia' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Sepia')).toBeInTheDocument()
    await expect(canvas.queryByText("Answer the agent's question")).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Send answer' })).not.toBeInTheDocument()
  },
}
