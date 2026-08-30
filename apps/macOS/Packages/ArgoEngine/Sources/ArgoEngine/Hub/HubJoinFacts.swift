/// The facts about ONE Session that can move the JOIN rather than only that Session's own contents.
///
/// A transcript's batch appends events and moves times; almost none of it can change WHICH rows the
/// roster draws or which chain each row is. These three can, and they are the whole list because
/// `HubSessionChain.roster` reads nothing else off a Session that the fold's SHAPE depends on: the
/// chain graph parents by `headLeafUUID` and `originSessionID`, and publication filters by
/// `isPublished`. The remaining shape inputs — a uuid two paths carry, a sibling's merge order —
/// are excluded by the row being solo and singly-pathed, which is what `HubRoster.replace` checks.
///
/// Compared before and after a batch rather than derived from the event kinds it carried: a kind
/// list would have to name every event that can set `hasAgentActivity`, and would go stale the day
/// one more does. What is asserted here is what actually MOVED.
struct HubJoinFacts: Equatable {
    private let headLeafUUID: String?
    private let originSessionID: String?
    private let isPublished: Bool

    init(of session: HubSession) {
        self.headLeafUUID = session.headLeafUUID
        self.originSessionID = session.originSessionID
        self.isPublished = HubSessionChain.isPublished(session)
    }
}
