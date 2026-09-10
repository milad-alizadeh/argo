export type SessionsListed = Awaited<ReturnType<Window['argo']['listSessions']>>
export type Session = SessionsListed['sessions'][number]
export type SessionId = Session['id']
export type SessionFeed = Awaited<ReturnType<Window['argo']['readSessionFeed']>>
export type SessionFeedRow = SessionFeed['rows'][number]
export type SessionsListRequest = Parameters<Window['argo']['listSessions']>[0]
export type SessionFeedRequest = Parameters<Window['argo']['readSessionFeed']>[0]
