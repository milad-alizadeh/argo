import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The tab line's leading edge, where the Ticket a Session is on becomes a route rather than a
/// fact only the ⓘ panel states (#1092; `cockpit-session-header.md`). Ahead of the tabs zone,
/// which draws nothing until #401–#404 land — the one place on this line that was empty.
///
/// It is also where a Session gets a Ticket at all. Most Sessions are on a branch naming no
/// number, so the derived link is `nil` for them and no route could ever appear: the picker here
/// is the one gesture that puts a Session on a Ticket regardless of what its branch is called, and
/// it is what makes the claim on the other side of the join appear too.
///
/// `nil` draws nothing at all: with no Ticket provider bound there are no Tickets to attach
/// (`CONTEXT.md` L1), the same rule the ⓘ panel's own `Issue` row follows.
struct SessionIssueLink: View {
    @Environment(\.argo) private var argo
    /// Point the cockpit at the ticket this link names. Travels through the environment for the
    /// reason `argoOpenSession` does — four views separate the tab line from the shell that holds
    /// the navigation model.
    @Environment(\.argoOpenTicket) private var openTicket
    /// What may be attached, and what already was — see `SessionTicketLinking`.
    @Environment(\.argoTicketLinking) private var linking

    let row: SessionHeaderProjection.Header.IssueRow?

    var body: some View {
        switch row {
        case let .link(link):
            // The press stays the route: a reader on a linked Session wants the Ticket, and the
            // repair is the rarer act. Re-linking and unlinking are on the secondary click.
            Button { openTicket(link.number) } label: {
                GlyphMarkLine(symbol: ArgoSymbol.ticketsRoom, text: link.label, ink: linkInk)
            }
            .buttonStyle(.plain)
            .help(helpForLink(named: link.label))
            .contextMenu { picker }
        case .unlinked where linking.isOffered:
            // Nothing to route to, so the press is the repair itself rather than a menu hidden
            // behind a secondary click nobody would look for on a word that reads as a dead end.
            Menu {
                picker
            } label: {
                // The accent, like every other pressable thing on this line: the reading it
                // replaces is quiet because it is a statement, and this one is an offer.
                GlyphMarkLine(
                    symbol: ArgoSymbol.ticketsRoom, text: SessionHeaderProjection.Header.linkVerb,
                    ink: linkInk,
                )
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
            .help("Attach this Session to a Ticket")
        case .unlinked:
            // States the reading and offers nothing: no backlog was read, so there is no ticket to
            // pick and a picker here would be a control that refuses every press.
            GlyphMarkLine(
                symbol: ArgoSymbol.ticketsRoom, text: SessionHeaderProjection.Header.unlinkedWord,
                ink: argo.color.text.tertiary,
            )
        case nil:
            EmptyView()
        }
    }

    /// The backlog to pick from, and the way back out of a pin. Shared by the two shapes above so
    /// the linked row's secondary click and the unlinked row's press can never offer two lists.
    @ViewBuilder private var picker: some View {
        ForEach(linking.options) { option in
            Button(option.label) { linking.link(option.number) }
        }
        if linking.pinned != nil {
            Divider()
            Button("Unlink from this Ticket") { linking.link(nil) }
        }
    }

    /// What the hover says over a link — the route, plus the fact that the secondary click is where
    /// the repair is, which a plain label has no other way to say.
    private func helpForLink(named label: String) -> String {
        let route = "Open \(label), the Ticket this Session is on"
        guard linking.isOffered else { return route }
        return route + "\nRight-click to link it to another Ticket"
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

#Preview("Session issue link — linked, unlinked, offered, unread") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        SessionIssueLink(row: .link(.init(number: 476, label: "Issue #476", detail: nil)))
        SessionIssueLink(row: .unlinked)
        SessionIssueLink(row: .unlinked)
            .environment(\.argoTicketLinking, .init(options: [
                .init(number: 1092, title: "Route between Session and Ticket"),
            ]))
        SessionIssueLink(row: nil)
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
