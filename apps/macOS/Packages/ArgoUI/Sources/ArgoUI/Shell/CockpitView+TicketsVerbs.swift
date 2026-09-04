import ArgoEngine
import SwiftUI

/// What the Tickets room's controls actually perform (#872) — the verbs `ticketsIntents` hands
/// down, and the composer New ticket opens.
///
/// Here rather than on the room: a verb reaches the provider port or a spawn, and neither is a
/// value the room could hold. The room takes closures for exactly that reason, and a preview passes
/// it inert ones.
extension CockpitView {
    /// The open ticket's own. `inert` with no ticket open — the ticket pane's header hides the pill
    /// there anyway (`TicketsRoom.panes`), and a verb addressing nobody must not be one press away
    /// from being drawn.
    ///
    /// **The two link verbs are gone** (#1242): the ticket's number is the link, so the pair that
    /// re-derived one address off `TicketAddress` said what `TicketHead` already says.
    func ticketsVerbs(_ start: TicketStart) -> TicketsChromeIntents.Verbs {
        guard let ticket = navigation.ticket else { return .inert }
        var verbs = TicketsChromeIntents.Verbs()
        verbs.start = { Task { await start.run(on: ticket, in: navigation) } }
        verbs.command = start.command(on: ticket)
        verbs.startOn = { picked in
            Task { await start.run(on: ticket, in: navigation, sending: picked) }
        }
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
