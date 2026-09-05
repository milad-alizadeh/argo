import ArgoEngine

/// What a DELEGATING call handed over, split off `FeedCall.swift` because that file is at the
/// length ceiling `.swiftlint.yml` holds it to — and because it is a value of its own: the sentence
/// a row draws never mentions any of it.
package extension FeedCall {
    /// What a DELEGATING call handed over: the child it started, what that child reported, and the
    /// call id the reader's End gesture names (#1267).
    ///
    /// One value rather than four slots on the sentence above, and none of it is DRAWN on the
    /// row — the rule that keeps a timestamp out of a call row is about the row's LAYOUT, not
    /// about what the reading carries. Empty for every call that handed nothing over.
    struct Handover: Equatable, Sendable {
        /// The Subagent the record named, and the rail's join key: it pairs a chip with that
        /// child's own reading, so a selected Agent scopes the feed onto its work rather than onto
        /// the line that handed it over. `nil` for a delegation the record has not answered yet —
        /// the name arrives with the result.
        package var subagentID: String?
        /// How long the delegation reported taking. Absent while a synchronous Subagent is still
        /// working, and for the whole life of a backgrounded one, which reports no total.
        var durationMs: Int?
        /// When the work was handed over — what a running chip counts up from, since a total it
        /// does not have yet cannot be drawn.
        var startedAtMs: Int?
        /// The delegating call's own id, and ONLY where the host answered the handover with a
        /// LAUNCH RECEIPT (#908): a backgrounded delegation the record has not closed, which is the
        /// one shape the reader can End (#1267).
        ///
        /// `nil` for a SYNCHRONOUS delegation, whose parent is genuinely blocked inside it, and for
        /// one whose report has landed — the record has already ended that. So this says both
        /// things the rail's control needs, and the ending above cannot: it folds the receipt into
        /// `pending` beside a synchronous call still running.
        package var openDelegationID: String?

        /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
        package init(
            subagentID: String? = nil,
            durationMs: Int? = nil,
            startedAtMs: Int? = nil,
            openDelegationID: String? = nil,
        ) {
            self.subagentID = subagentID
            self.durationMs = durationMs
            self.startedAtMs = startedAtMs
            self.openDelegationID = openDelegationID
        }
    }
}
