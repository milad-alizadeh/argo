import ArgoEngine

package extension SessionRosterProjection {
    /// The row the deck has open, and the one fact only that row can carry.
    ///
    /// The roster walks THREE of the rail's four facts per row, off each Session's own stream. The
    /// fourth answers off a Subagent's OWN file, growing, and Argo holds that for whichever Session
    /// the deck has open (`Hub.subagentGrewAtMs`) — walking every child's file per row is the cost
    /// #1394 removed. So it arrives here already taken, for the one Session it can be taken for.
    ///
    /// Both facts in one value because they are one fact: which row is open is exactly what says
    /// whose fourth fact this is, and a pair of parameters would let a caller state the telling of
    /// one Session against the id of another.
    ///
    /// Not `Selection`, which is the SET of rows the `List` paints its ground under. One row is
    /// open in the deck; several can be selected at once (#1247).
    struct Focus: Sendable, Equatable {
        /// The Session the deck is drawing, or `nil` where the window is drawing none. What opens
        /// a fold whatever the reader did (`Folding`).
        let sessionID: String?
        /// That Session's delegations, TOLD — the rail's own list, dated by the children's files.
        ///
        /// `nil` where nobody took the fourth fact: a specimen, a `#Preview`, a suite, or a window
        /// whose reader has nothing to ask. That leaves the row on the three facts it walks, which
        /// is the honest reading and not a degraded one.
        ///
        /// Reached only through `told(of:)`, so no caller can read a telling without the id that
        /// says whose it is.
        private let telling: [FeedAgent]?

        package init(sessionID: String? = nil, told: [FeedAgent]? = nil) {
            self.sessionID = sessionID
            self.telling = told
        }

        /// The telling for THIS Session, or `nil` for every other row — the gate that keeps the
        /// fourth fact on the one row it is a fact about.
        func told(of sessionID: String) -> [FeedAgent]? {
            self.sessionID == sessionID ? telling : nil
        }
    }

    /// The fourth fact, taken where the reader lives: on the main actor, for the open Session
    /// alone (#1513).
    ///
    /// Here rather than inside `rows(from:opened:focus:now:)` because the projection is
    /// nonisolated — the roster is derived by suites and specimens off the main actor — and the
    /// engine's answers are not. Taking it at the seam keeps one main-actor hop per pass instead of
    /// one per row, which is also the arithmetic the out-of-scope note in #1513 is about.
    ///
    /// A Session whose own state Argo cannot place is passed over: a Session Argo cannot place
    /// cannot be claimed to be delegating either (rule 5), so there is nothing here to tell.
    @MainActor static func focus(
        on sessionID: String?,
        among sessions: [CockpitPresentation.Session],
        asking reader: FeedAgentReader,
        at nowMs: Int,
    )
        -> Focus {
        guard let sessionID,
              let session = sessions.first(where: { $0.id == sessionID }),
              SessionState.role(for: session.status) != nil
        else { return Focus(sessionID: sessionID) }
        return Focus(
            sessionID: sessionID,
            told: reader.dated(delegations(of: session), at: nowMs),
        )
    }
}
