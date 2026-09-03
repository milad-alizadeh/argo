import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The tab line's leading edge, where the Ticket a Session is on becomes a route rather than a
/// fact only the ⓘ panel states (#1092; `cockpit-session-header.md`). Ahead of the tabs zone,
/// which draws nothing until #401–#404 land — the one place on this line that was empty.
///
/// `nil` draws nothing at all: with no Ticket provider bound there are no Tickets to attach
/// (`CONTEXT.md` L1), the same rule the ⓘ panel's own `Issue` row follows.
struct SessionIssueLink: View {
    @Environment(\.argo) private var argo
    /// Point the cockpit at the ticket this link names. Travels through the environment for the
    /// reason `argoOpenSession` does — four views separate the tab line from the shell that holds
    /// the navigation model.
    @Environment(\.argoOpenTicket) private var openTicket

    let row: SessionHeaderProjection.Header.IssueRow?

    var body: some View {
        switch row {
        case let .link(link):
            Button { openTicket(link.number) } label: {
                GlyphMarkLine(symbol: ArgoSymbol.ticketsRoom, text: link.label, ink: linkInk)
            }
            .buttonStyle(.plain)
            .help("Open \(link.label), the Ticket this Session is on")
        case .unlinked:
            // States the reading rather than offering a route: nothing names a Ticket to open, and
            // the repair is cutting a branch that does, not a click here.
            GlyphMarkLine(
                symbol: ArgoSymbol.ticketsRoom, text: SessionHeaderProjection.Header.unlinkedWord,
                ink: argo.color.text.tertiary,
            )
        case nil:
            EmptyView()
        }
    }

    /// The ink this app spends on every other link (`FeedMarkLine`'s handoff, `FeedProseText`'s
    /// markdown links) — reused rather than re-decided here.
    private var linkInk: ArgoColor {
        argo.color.interaction.accent
    }
}

extension EnvironmentValues {
    /// Point the cockpit at a Ticket, opening the Tickets room on it. Travels in the environment
    /// for `argoOpenSession`'s own reason.
    ///
    /// Inert by default, so every specimen and `#Preview` draws the link without a navigation
    /// model behind it.
    @Entry var argoOpenTicket: (Int) -> Void = { _ in }
}

#Preview("Session issue link — linked, unlinked, unread") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        SessionIssueLink(row: .link(.init(number: 476, label: "Issue #476", detail: nil)))
        SessionIssueLink(row: .unlinked)
        SessionIssueLink(row: nil)
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
