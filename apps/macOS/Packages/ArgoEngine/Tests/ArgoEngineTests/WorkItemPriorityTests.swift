@testable import ArgoEngine
import Testing

/// The one ladder a provider's priority word is MATCHED against (#273). The words stay the
/// provider's; only the rung is Argo's, and a word nobody knows earns no rung of its own.
@Suite("Work Item priority ladder")
struct WorkItemPriorityTests {
    @Test(arguments: [
        ("high", WorkItemPriority.high),
        ("High", .high),
        ("HIGH", .high),
        ("medium", .medium),
        ("low", .low),
    ])
    func `a known word matches its rung whatever case it is spelled in`(
        word: String, rung: WorkItemPriority,
    ) {
        #expect(WorkItemPriority(word: word) == rung)
    }

    /// The word survives so a caller can still render it verbatim — matching it to no rung is not
    /// licence to forget what the tracker said.
    @Test
    func `an unknown word keeps its own spelling`() {
        #expect(WorkItemPriority(word: "P0") == .other("P0"))
    }

    /// Absent is not a rung. A ticket nobody read a priority for sits below every word there is,
    /// including the ones this ladder has never heard of.
    @Test
    func `the rungs run high to unread, with unknown words between low and absent`() {
        let ladder: [WorkItemPriority] = [.high, .medium, .low, .other("P0"), .unread]

        #expect(ladder.map(\.rung) == [0, 1, 2, 3, 4])
    }

    /// Two words nothing has ordered are not ordered here either: the ladder says they are both
    /// below `low`, and nothing further.
    @Test
    func `two unknown words share one rung`() {
        #expect(WorkItemPriority(word: "P0").rung == WorkItemPriority(word: "urgent-ish").rung)
    }

    @Test
    func `a ticket with no priority word reads as unread`() {
        let item = WorkItem(number: 1, title: "A ticket", status: "Todo", closure: .open)

        #expect(item.priorityRung == .unread)
    }
}
