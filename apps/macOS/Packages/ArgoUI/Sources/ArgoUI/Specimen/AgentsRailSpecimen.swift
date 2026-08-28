import SwiftUI

/// The rail's states, each rendered against the feed it sits beside.
///
/// Beside the feed and not alone, because that is what the claims are about: flat with a straight
/// seam, and subordinate to the reading. A rail rendered in its own frame can satisfy both in prose
/// and neither in pixels, which is how the discarded attempt passed its own review (#378).
struct AgentsRailSpecimen: View {
    /// Which state this renders. Each is one a still can settle; the fan-out under the canopy is
    /// `AgentsFanOutSpecimen`, because that one needs a scroll position.
    enum Subject {
        /// One Agent, still out. A list of one, with the count line over it.
        case sole
        /// The feed scoped onto one Agent. Two claims in one still: that the selected chip is
        /// legible beside the ones that are not, and that the SAME feed changed rather than a
        /// second one appearing.
        case scoped
        /// The rail as its dot strip, with the feed taking the width back.
        case collapsed
    }

    let subject: Subject

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: feed,
            header: SessionHeaderFixture.header(for: .managed),
            readings: AgentsRailFixture.readings,
            scope: .constant(scope),
            isRailCollapsed: subject == .collapsed,
        )
    }

    private var feed: [FeedRow] {
        subject == .sole ? AgentsRailFixture.soleAgentRows : FeedProjection.previewRows
    }

    /// Index 2 is the preview transcript's one ANSWERED delegation, and so the only chip with a
    /// reading behind it — see `AgentsRailFixture`.
    private var scope: FeedScope {
        subject == .scoped ? .subagent(2) : .session
    }
}

#Preview("Agents rail — one Agent, still out") {
    AgentsRailSpecimen(subject: .sole)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — the feed scoped onto one Agent") {
    AgentsRailSpecimen(subject: .scoped)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — collapsed to dots, the feed taking the width") {
    AgentsRailSpecimen(subject: .collapsed)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}
