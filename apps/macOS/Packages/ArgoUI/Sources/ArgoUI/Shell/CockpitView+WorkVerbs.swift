import ArgoEngine
import SwiftUI

/// What the Work room's row actually performs (#872) — the four verbs `workIntents` hands down, and
/// the composer New ticket opens.
///
/// Here rather than on the room: a verb reaches the provider port, the pasteboard, the browser or a
/// spawn, and none of those is a value the room could hold. The room takes closures for exactly
/// that reason, and a preview passes it inert ones.
extension CockpitView {
    /// The open ticket's own three. `inert` with no ticket open — the row hides the vessel there
    /// anyway (`WorkToolbar`), and a verb addressing nobody must not be one press away from being
    /// drawn.
    ///
    /// The two link verbs are ABSENT where the Binding cannot address the ticket, which is what
    /// disables them: a Linear Binding holds a team id, and no page is derivable from one
    /// (`WorkItemAddress`).
    var workVerbs: WorkToolbarIntents.Verbs {
        guard let ticket = navigation.ticket else { return .inert }
        var verbs = WorkToolbarIntents.Verbs()
        verbs.start = { Task { await startSession(on: ticket) } }
        guard let url = workItemAddress?.browseURL(of: ticket) else { return verbs }
        verbs.openOnHost = { openURL(url) }
        // The same URL the verb beside it opens, off one derivation: two readings of one address
        // is how a copied link comes to point somewhere else than the one that opened.
        verbs.copyLink = { ArgoPasteboard.put(url.absoluteString) }
        return verbs
    }

    /// Start a Session on the open ticket, on the rung the row names (`held.mode`).
    ///
    /// The window stays in the Work room. The answer the reader asked for is the backlog row going
    /// claimed, which happens here — switching them into the Sessions room would take the list they
    /// were triaging away at the moment it told them something.
    private func startSession(on ticket: Int) async {
        guard let fresh = await actions.work.startSession(ticket, navigation.workMode) else {
            return
        }
        // Selected but not switched to: the roster is on the fresh Session whenever they go there.
        navigation.session = fresh
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
    func createTicket(_ draft: WorkItemDraft) {
        ticketWrite = .pending
        Task {
            guard let refusal = await actions.work.createWorkItem(draft) else {
                ticketWrite = .idle
                isComposingTicket = false
                return
            }
            ticketWrite = .failed(refusal)
        }
    }
}
