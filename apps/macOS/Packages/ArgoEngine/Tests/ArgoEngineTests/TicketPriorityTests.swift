@testable import ArgoEngine
import Testing

/// The one ladder a provider's priority word is MATCHED against (#273). The words stay the
/// provider's; only the rung is Argo's, and a word nobody knows earns no rung of its own.
@Suite("Ticket priority ladder")
struct TicketPriorityTests {
    @Test(arguments: [
        ("high", TicketPriority.high),
        ("High", .high),
        ("HIGH", .high),
        ("medium", .medium),
        ("low", .low),
    ])
    func `a known word matches its rung whatever case it is spelled in`(
        word: String, rung: TicketPriority,
    ) {
        #expect(TicketPriority(word: word) == rung)
    }

    /// Two words nothing has ordered are not told apart here: the ladder says both sit below `low`,
    /// and nothing further. Which is why the case carries no word.
    @Test
    func `every unknown word is the same rung`() {
        #expect(TicketPriority(word: "P0") == .other)
        #expect(TicketPriority(word: "P0") == TicketPriority(word: "urgent-ish"))
    }

    /// Absent is not a rung. A ticket nobody read a priority for sits below every word there is,
    /// including the ones this ladder has never heard of.
    @Test
    func `the rungs run high to unread, with unknown words between low and absent`() {
        let ladder: [TicketPriority] = [.high, .medium, .low, .other, .unread]

        #expect(ladder.map(\.rung) == [0, 1, 2, 3, 4])
    }

    @Test
    func `a ticket with no priority word reads as unread`() {
        let item = Ticket(number: 1, title: "A ticket", status: "Todo", closure: .open)

        #expect(item.priorityRung == .unread)
    }
}
