import ArgoEngine
import SwiftUI

/// What the Tickets room's row actually performs (#872) — the four verbs `ticketsIntents` hands
/// down, and the composer New ticket opens.
///
/// Here rather than on the room: a verb reaches the provider port, the pasteboard, the browser or a
/// spawn, and none of those is a value the room could hold. The room takes closures for exactly
/// that reason, and a preview passes it inert ones.
extension CockpitView {
    /// The open ticket's own three. `inert` with no ticket open — the row hides the vessel there
    /// anyway (`TicketsToolbar`), and a verb addressing nobody must not be one press away from
    /// being drawn.
    ///
    /// The two link verbs are ABSENT where the Binding cannot address the ticket, which is what
    /// disables them: a Linear Binding holds a team id, and no page is derivable from one
    /// (`TicketAddress`).
    func ticketsVerbs(_ start: TicketStart) -> TicketsToolbarIntents.Verbs {
        guard let ticket = navigation.ticket else { return .inert }
        var verbs = TicketsToolbarIntents.Verbs()
        verbs.start = { Task { await start.run(on: ticket, in: navigation) } }
        verbs.command = start.command(on: ticket)
        guard let url = ticketAddress?.browseURL(of: ticket) else { return verbs }
        verbs.openOnHost = { openURL(url) }
        // The same URL the verb beside it opens, off one derivation: two readings of one address
        // is how a copied link comes to point somewhere else than the one that opened.
        verbs.copyLink = { ArgoPasteboard.put(url.absoluteString) }
        return verbs
    }

    /// Starting a Session on a ticket, assembled from the two readings the act needs and the room
    /// does not: the listing the labels are on, and the screens this checkout has a design for
    /// (#899). The rule itself is `WorkCommand`'s, and it is `TicketStart` that performs the act.
    var ticketStart: TicketStart {
        TicketStart(
            tickets: tickets,
            designs: actions.tickets.designedScreens,
            spawn: { await actions.tickets.startSession($0, $1, $2) },
        )
    }

    /// Open the composer on an empty ticket, and on nothing a refused write left behind: a sheet
    /// that opened on the last refusal's words would be composing somebody else's ticket.
    func openTicketComposer() {
        ticketComposition = TicketComposition()
        ticketWrite = .idle
        isComposingTicket = true
    }

    /// File what was typed. `pending` disables the control in place while it is on the wire, and a
    /// refusal returns it pressable with the provider's own words beside it — §4, which also rules
    /// out any retry of its own.
    ///
    /// The sheet stays up on a refusal, holding what was typed. Closing it would throw away the
    /// only copy of a ticket the provider declined for a reason the reader can often fix.
    func createTicket(_ draft: TicketDraft) {
        ticketWrite = .pending
        Task {
            guard let refusal = await actions.tickets.createTicket(draft) else {
                ticketWrite = .idle
                isComposingTicket = false
                return
            }
            ticketWrite = .failed(refusal)
        }
    }

    /// Put the composer away, and the refusal it was holding with it. The row's New ticket button
    /// renders `ticketWrite` too, so a `failed` left standing here would draw a refusal beside a
    /// write nobody can now see or retry — the live-and-inert control this ticket is about.
    func closeTicketComposer() {
        isComposingTicket = false
        ticketWrite = .idle
    }
}
