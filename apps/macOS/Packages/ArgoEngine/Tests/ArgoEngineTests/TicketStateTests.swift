@testable import ArgoEngine
import Testing

/// The canonical state bucket, and the blocker rule that decides whether a ticket can be picked
/// up (#167, `CONTEXT.md` L1 · Ticket).
@Suite("Ticket state")
struct TicketStateTests {
    @Test(arguments: [
        (TicketClosure.open, false, TicketState.open),
        (.open, true, .claimed),
        (.resolved, false, .resolved),
        (.ruledOut, false, .ruledOut),
        // A closure nobody could read still closed the ticket, and resolved is the answer that
        // keeps a dependent map moving.
        (.closedUnreadably, false, .resolved),
    ])
    func `a closure and a claim settle the bucket`(
        closure: TicketClosure, claimed: Bool, bucket: TicketState,
    ) {
        #expect(TicketState(closure: closure, claimed: claimed) == bucket)
    }

    @Test
    func `a ticket closed while a Session holds it reads closed rather than claimed`() {
        // The provider's answer outranks Argo's: a claim that survived closure would leave the
        // room advertising work that is already done.
        #expect(TicketState(closure: .resolved, claimed: true) == .resolved)
    }

    @Test
    func `a ticket with no blockers is clear`() {
        #expect(TicketBlockage(blockers: []) == .clear)
    }

    @Test
    func `a ticket whose every blocker was completed is clear`() {
        let blockers = [TicketBlocker(number: 1, closure: .resolved)]

        #expect(TicketBlockage(blockers: blockers) == .clear)
    }

    @Test
    func `an open blocker blocks`() {
        let blockers = [
            TicketBlocker(number: 1, closure: .resolved),
            TicketBlocker(number: 2, closure: .open),
        ]

        #expect(TicketBlockage(blockers: blockers) == .blocked)
    }

    @Test
    func `a blocker that was ruled out strands its dependent`() {
        // Argo disagrees with the GitHub and Linear UIs, which count a cancelled blocker as
        // satisfied: the dependent's premise was cancelled and a human owes a decision.
        let blockers = [TicketBlocker(number: 1, closure: .ruledOut)]

        #expect(TicketBlockage(blockers: blockers) == .stranded)
    }

    @Test
    func `a stranding blocker outranks one that is merely open`() {
        let blockers = [
            TicketBlocker(number: 1, closure: .open),
            TicketBlocker(number: 2, closure: .ruledOut),
        ]

        // Blocked clears itself as work lands; stranded never will, so it is the one to say.
        #expect(TicketBlockage(blockers: blockers) == .stranded)
    }

    @Test
    func `a blocker closed for a reason nothing can read satisfies its edge`() {
        // The degradation is asymmetric on purpose: a port that cannot read closure kinds produces
        // a chrome notice, never a tree of stranded tickets.
        let blockers = [TicketBlocker(number: 1, closure: .closedUnreadably)]

        #expect(TicketBlockage(blockers: blockers) == .clear)
    }
}
