import ArgoEngine

/// What the ⓘ panel's `This Session` block reports (#694): the facts the two-row header demoted to
/// the titlebar's hover, on a route a keyboard and a screenshot both have.
///
/// A fact Argo could not establish is **absent**, never a zero and never a dash (`CONTEXT.md`
/// degrade-down). The block says the same facts the hover says, in the panel's own register: the
/// hover is prose and speaks in sentences, this is a column and speaks in readings.
extension SessionHeaderProjection {
    /// One row: the term the panel labels it with, and the reading itself.
    package struct Fact: Equatable, Sendable, Identifiable {
        let term: String
        /// The reading alone — `Started` carries `2h ago`, because the term has said the rest.
        let value: String

        package var id: String {
            term
        }
    }

    /// The block, in the design's order.
    static func facts(
        from session: CockpitPresentation.Session,
        worked: Worked? = nil,
    )
        -> [Fact] {
        [Fact(term: "Context", value: context(tokens: session.contextTokens).reading)]
            + telemetry(from: session, worked: worked ?? .read(across: session.events))
            + [
                // The CLI alone here too (#558): the guide is the header's own surface, and
                // the header does not repeat what the composer states.
                agent(cli: session.cli)
                    .map { Fact(term: "Agent", value: $0) },
                checkout(for: session.workspace)
                    .map { Fact(term: "Branch", value: branchReading($0, in: session)) },
                row(for: session.ticket).map { Fact(term: "Issue", value: issueReading($0)) },
                mark(for: session.access).map { Fact(term: "Access", value: $0.word) },
                // Under Access: what Argo owns of this Session, then what it can hear (#493).
                companion(for: session.companionChannel)
                    .map { Fact(term: "Companion", value: $0) },
            ].compactMap(\.self)
    }

    /// What the Session has spent and how long it has been going, one fact per row. Subagent spend
    /// is the one the spend line carries and this does not: it is `nil` on every CLI in use, and a
    /// row that is always absent is a column of terms nobody ever sees.
    private static func telemetry(
        from session: CockpitPresentation.Session,
        worked: Worked,
    )
        -> [Fact] {
        [
            session.spentTokens.map { Fact(term: "Tokens spent", value: TokenCount.short($0)) },
            session.cachedTokens.map { Fact(term: "Cached", value: TokenCount.short($0)) },
            ran(from: session).map {
                Fact(term: "Started", value: "\(ElapsedTime.phrase(milliseconds: $0)) ago")
            },
            worked.milliseconds.map { Fact(term: "Worked", value: workedReading($0)) },
        ].compactMap(\.self)
    }

    /// `argo/#476-feed-scroll-anchor · 3 uncommitted files`. The marks hang off the branch, the way
    /// the fact line drew them and the hover still says them — nothing else in the deck renders
    /// them now that the band is gone. The checkout KIND stays off: the roster row marks it.
    private static func branchReading(
        _ checkout: Header.Checkout,
        in session: CockpitPresentation.Session,
    )
        -> String {
        ([checkout.branch] + marks(for: session.workspace).map(\.detail)).joined(separator: " · ")
    }

    /// `#476 — Anchor the feed on its newest line`. The number is bare here, unlike the line's own
    /// `Issue #476`, because the row's term has already said the word.
    private static func issueReading(_ row: Header.IssueRow) -> String {
        guard let link = row.link else { return Header.unlinkedWord }
        return IssueReading.words(number: link.number, title: link.detail)
    }
}
