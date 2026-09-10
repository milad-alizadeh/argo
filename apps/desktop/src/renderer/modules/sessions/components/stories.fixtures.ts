import type { Session, SessionFeed, SessionFeedRow } from '../types'

export const sessionStory: Session = { id: 'session-42' } as Session
export const feedRowStory: SessionFeedRow = { id: 'row-42' } as SessionFeedRow
export const feedStory: SessionFeed = { rows: [feedRowStory] } as SessionFeed
