@testable import ArgoEngine
import Testing

/// How many blockers a Ticket is still waiting on, and the silence where nobody said.
///
/// The count is what a backlog row marks (#896), so the two silences have to stay apart here: a
/// provider SAYING the way is clear counts zero, and a provider that served no edges at all counts
/// nothing (`CONTEXT.md` L2 · degrade-down).
@Suite("Ticket standing blockers")
struct TicketBlockerCountTests {
    private static func item(blockedBy: [TicketBlocker]?) -> Ticket {
        Ticket(number: 1, title: "A ticket", status: "Todo", closure: .open, blockedBy: blockedBy)
    }

    @Test
    func `a provider that served no edges counts nothing, never zero`() {
        #expect(Self.item(blockedBy: nil).standingBlockers == nil)
    }

    @Test
    func `a provider saying there is nothing in the way counts zero`() {
        #expect(Self.item(blockedBy: []).standingBlockers == 0)
    }

    @Test
    func `only the blockers that satisfy nothing are counted`() {
        let item = Self.item(blockedBy: [
            TicketBlocker(number: 2, closure: .open),
            TicketBlocker(number: 3, closure: .open),
            TicketBlocker(number: 4, closure: .resolved),
            TicketBlocker(number: 5, closure: .closedUnreadably),
        ])

        #expect(item.standingBlockers == 2)
    }

    /// A ruled-out blocker is closed and still counts: it satisfies nothing
    /// (`TicketClosure.satisfiesBlocker`), so a count that dropped it would leave a stranded ticket
    /// marked as though the way were clear.
    @Test
    func `a ruled-out blocker still counts`() {
        let item = Self.item(blockedBy: [TicketBlocker(number: 2, closure: .ruledOut)])

        #expect(item.standingBlockers == 1)
        #expect(item.blockage == .stranded)
    }
}
