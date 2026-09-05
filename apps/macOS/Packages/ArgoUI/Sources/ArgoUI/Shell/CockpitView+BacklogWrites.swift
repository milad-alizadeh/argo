import ArgoEngine
import SwiftUI

/// What the backlog's right-click menu performs over a whole selection (#1247), and what it
/// reports when the provider takes some of it and refuses the rest.
///
/// Here rather than on the room: each of these reaches the Ticket port, and neither the room nor
/// the list is a value that could hold one.
extension CockpitView {
    /// The menu the backlog rows draw, over the provider bound to this window. A provider that
    /// writes no transition offers no **Mark as**, and one that cannot delete offers no
    /// **Delete** — declared, never discovered by a write coming back refused (ADR-0014).
    var backlogActs: BacklogSelectionActs {
        guard let surface = TicketsProvider.surface(of: health) else {
            return BacklogSelectionActs()
        }
        return BacklogSelectionActs(
            states: BacklogSelectionProjection.markable(surface),
            deletes: surface.offers(.delete),
            mark: { markTickets($0, as: $1) },
            delete: { deleteTickets($0) },
        )
    }

    /// Write one state to every selected Ticket.
    func markTickets(_ numbers: [Int], as state: TicketCanonicalState) {
        writeEach(numbers, named: BacklogSelectionProjection.markAct(state)) {
            await actions.tickets.writes.applyIntent(.transitionTo(state), $0)
        }
    }

    /// Remove every selected Ticket.
    func deleteTickets(_ numbers: [Int]) {
        writeEach(numbers, named: BacklogSelectionProjection.deleteAct) {
            await actions.tickets.writes.deleteTicket($0)
        }
    }

    /// One write per Ticket, in the selection's own order, and the refusals gathered as they come.
    ///
    /// **Serial, and nothing is rolled back.** One at a time because a provider's write limits are
    /// the reason a batch would be refused halfway in the first place; and the Tickets that landed
    /// keep the new state, because unwriting them to make the batch look atomic is a second write
    /// nobody asked for (`BacklogWriteReport`).
    private func writeEach(
        _ numbers: [Int], named verb: String, each: @escaping (Int) async -> TicketWriteError?,
    ) {
        Task {
            var refusals: [BacklogWriteReport.Refusal] = []
            for number in numbers {
                guard let refusal = await each(number) else { continue }
                refusals.append(BacklogWriteReport.Refusal(
                    number: number, reason: refusal.reason,
                ))
            }
            guard !refusals.isEmpty else { return }
            backlogWriteReport = BacklogWriteReport(verb: verb, refusals: refusals)
        }
    }
}

extension TicketsProvider {
    /// What the bound Ticket adapter DECLARES it can write, and `nil` where nothing is bound —
    /// read before a control is drawn, never after a write comes back refused (ADR-0014).
    static func surface(of reading: ConnectionHealthReading) -> TicketSurface? {
        guard let found = reading.connections.first(where: { $0.port == .ticket })
        else { return nil }
        return ProviderTicketWrites().port(of: found.account.provider).surface
    }
}
