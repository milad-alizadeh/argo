import ArgoDesign
import ArgoUI
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
        /// The same feed RE-SCOPED after it was drawn: the Session's reading replaced under one
        /// handle, which is the state a rail chip actually leads to and the one `scoped` cannot
        /// show. It opens on the Session and is scoped a pass later, so what this renders is the
        /// switch's result rather than a deck mounted onto the destination — the row heights are
        /// this reading's and the lane maps this document, or neither is (#1012).
        case rescoped
        /// The same fan-out beside a Session that is NOT running: `0 running` on the count line, no
        /// clock on a delegation whose report never landed (#1076), and — since #1090 — a column
        /// holding none of them. What was handed over is behind the disclosure at the foot, which
        /// is the whole rail when nothing is at work.
        case quiet
        /// A Session that IS running, holding delegations from yesterday whose reports never
        /// landed — the state #1090 was written from, and the one `quiet` cannot show because there
        /// the Session had gone. The rail lists the one live Agent, says `1 running`, and holds the
        /// three stale ones behind the disclosure at the foot (`AgentsRailFixture.staleRows`).
        case stale
        /// A parent that handed its whole fan-out over and is now WAITING on it (#1269): two
        /// chips drawn running off the children's OWN files, and one drawn unknown. The state
        /// `quiet` and `stale` cannot show — in both of those the parent's status decided the
        /// chips. `AgentsRailFixture.waitingRows` carries the rest.
        case waiting
        /// The meter under three backgrounded chips, none of which reported a figure (#1279): one
        /// the record answered, drawn with the span and the roll-up of its OWN file; one still
        /// writing, showing the tokens read so far and still counting up; and one Argo has no
        /// reading of, whose meter is empty. `AgentsRailFixture.measuredRows` carries the rest.
        case measured
        /// The rail as its dot strip, with the feed taking the width back.
        case collapsed
        /// The strip while the feed is scoped onto an Agent — the state that proves the way back
        /// survives collapsing (#1013), which the strip on the Session's own reading cannot.
        case collapsedScoped
    }

    let subject: Subject

    /// The scope as the SHELL owns it — see `CockpitView.feedScope`. A `@State` and not a constant,
    /// because a constant renders a deck that opened scoped and never one that was re-scoped.
    @State private var live = FeedScope.session

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: feed,
            header: SessionHeaderFixture.header(for: .managed),
            readings: readings,
            scope: subject == .rescoped ? $live : .constant(scope),
            isRailCollapsed: subject == .collapsed || subject == .collapsedScoped,
        )
        .onAppear {
            guard subject == .rescoped else { return }
            live = .subagent(2)
        }
    }

    /// Each state's records read as that state's Session — see `AgentsRailFixture`.
    private var readings: FeedAgentReader {
        switch subject {
        case .quiet: AgentsRailFixture.quietReadings
        case .waiting: AgentsRailFixture.waitingReadings
        case .measured: AgentsRailFixture.measuredReadings
        default: AgentsRailFixture.readings
        }
    }

    private var feed: [FeedRow] {
        switch subject {
        case .sole: AgentsRailFixture.soleAgentRows
        case .stale: AgentsRailFixture.staleRows
        case .waiting: AgentsRailFixture.waitingRows
        case .measured: AgentsRailFixture.measuredRows
        case .scoped, .rescoped, .quiet, .collapsed, .collapsedScoped:
            FeedProjection.previewRows
        }
    }

    /// Index 2 is the preview transcript's one ANSWERED delegation, and so the only chip with a
    /// reading behind it — see `AgentsRailFixture`.
    private var scope: FeedScope {
        subject == .scoped || subject == .collapsedScoped ? .subagent(2) : .session
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

#Preview("Agents rail — the feed re-scoped onto one Agent by a chip") {
    AgentsRailSpecimen(subject: .rescoped)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — the same fan-out, beside a session that is not running") {
    AgentsRailSpecimen(subject: .quiet)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — a running session holding yesterday's delegations") {
    AgentsRailSpecimen(subject: .stale)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — an idle parent whose children are still writing") {
    AgentsRailSpecimen(subject: .waiting)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — three background chips, measured off their own files") {
    AgentsRailSpecimen(subject: .measured)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — collapsed to dots, the feed taking the width") {
    AgentsRailSpecimen(subject: .collapsed)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — collapsed while the feed is scoped onto an Agent") {
    AgentsRailSpecimen(subject: .collapsedScoped)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}
