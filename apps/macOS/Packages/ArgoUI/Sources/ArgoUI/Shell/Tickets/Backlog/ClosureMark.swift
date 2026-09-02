import ArgoDesign
import ArgoEngine
import SwiftUI

/// How a closed backlog row stopped being open (#1075), on the row itself rather than one ticket at
/// a time in the pane beside it.
///
/// **A word, not a glyph.** `resolved` and `ruledOut` are the two answers the `Closed` view exists
/// to keep apart, and a pair of marks a reader has to learn is a worse way to say a difference the
/// language already has two words for. It also lets the third case say what it is: a port that
/// could not read WHICH closure this was says `closed` and claims neither (`TicketClosure`).
///
/// The ink is `text.tertiary` — the same demotion a rail's title takes. A closed row is not a
/// warning and not an outcome that needs a colour: `state.failure` is spent on things that failed,
/// and a ticket somebody decided against did not fail.
struct ClosureMark: View {
    @Environment(\.argo) private var argo

    let closure: TicketClosure

    var body: some View {
        Text(Self.word(of: closure))
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.tertiary)
            // Rigid for the `#id`'s reason: `ruled out` is one fact, not a column of two.
            .fixedSize()
            // The row speaks it as part of one sentence — see `BacklogRow.announcement`.
            .accessibilityHidden(true)
    }

    /// `TicketState.filing`'s own vocabulary for the two that map cleanly, and the honest degrade
    /// for the one that does not. `closedUnreadably` must NOT reach `resolved` here — `TicketState`
    /// folds it there because a bucket has to choose, and this does not.
    nonisolated static func word(of closure: TicketClosure) -> String {
        switch closure {
        case .open: TicketState.open.filing
        case .resolved: TicketState.resolved.filing
        case .ruledOut: TicketState.ruledOut.filing
        case .closedUnreadably: "closed"
        }
    }
}

#Preview("Closure mark — resolved, ruled out, and a closure nobody could read") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ClosureMark(closure: .resolved)
        ClosureMark(closure: .ruledOut)
        ClosureMark(closure: .closedUnreadably)
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
