import type { Meta, StoryObj } from '@storybook/react'
import { PULL_REQUEST_STATES, PullRequestAddress } from './PullRequestAddress'
import { SessionListItem } from './SessionListItem'
import { partialSessionStory, sessionStory, workingSessionStory } from './stories.fixtures'

const pullRequestStory = workingSessionStory.pullRequest ?? { number: 0, url: '', repository: null }

const meta: Meta<typeof SessionListItem> = {
  title: 'Sessions/SessionListItem',
  component: SessionListItem,
  tags: ['autodocs'],
  args: { focusable: true, onFocus: () => undefined, onSelect: () => undefined },
}

export default meta
type Story = StoryObj<typeof SessionListItem>

// An external Session asking the reader something: Argo does not own its terminal, so the row is
// ghosted whole, and the status word is drawn because the reader has to stop for it.
export const Default: Story = { args: { session: sessionStory, selected: false } }
// A Session Argo started and that is working now: the running dot with two Subagent pips under
// it, what it last did, the Turn's clock in the running ink, a Plan part done, and the pull request
// it opened trailing line 3. No reading has that pull request's state, so its number is quiet.
export const Working: Story = { args: { session: workingSessionStory, selected: false } }
// The four states the code host names, in the host's own inks, for when a reading has one.
export const PullRequestStates: Story = {
  args: { session: workingSessionStory, selected: false },
  render: () => (
    <span className="flex gap-3">
      {PULL_REQUEST_STATES.map((state) => (
        <PullRequestAddress key={state} pullRequest={pullRequestStory} state={state} />
      ))}
    </span>
  ),
}
// Past five running Subagents the column says how many it is not drawing.
export const ManySubagents: Story = {
  args: {
    session: {
      ...workingSessionStory,
      delegations: Array.from({ length: 7 }, (_, index) => ({
        id: `call-${index}`,
        label: null,
        landed: false,
      })),
    },
    selected: false,
  },
}
// A settled Session: no activity line, an age rather than a Turn clock, and a banked Plan.
export const Settled: Story = {
  args: { session: { ...workingSessionStory, status: 'idle' }, selected: false },
}
// Selection is the ground and nothing else: no leading accent rule on the row.
export const Selected: Story = { args: { session: workingSessionStory, selected: true } }
// Every fact this row cannot establish, drawn as absent: no title and no time. Its state is
// unknown, so its open delegation draws no pip, and what Argo could not read of the transcript is
// not said on the row at all: it is a fact about Argo's reading and not about the run.
export const PartlyRead: Story = { args: { session: partialSessionStory, selected: false } }
// The Ticket this run answers to, beside the pull request on line 3. Nothing reads a Ticket
// number yet, so this story is the only place the address is drawn (#1907).
export const WithTicket: Story = {
  args: { session: workingSessionStory, selected: false, ticket: 1269 },
}
