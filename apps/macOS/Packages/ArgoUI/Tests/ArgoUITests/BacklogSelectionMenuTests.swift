import ArgoEngine
@testable import ArgoUI
import Testing

/// What the backlog's right-click menu says, what it offers, and what it acts on (#1247).
@Suite("The backlog's selection menu")
struct BacklogSelectionMenuTests {
    /// A menu carries no rows to point at, so it says how many it covers. One row keeps the plain
    /// singular, which is the menu the reader has always had.
    @Test
    func `the titles count what the press covers`() {
        #expect(BacklogSelectionProjection.deleteTitle(count: 3) == "Delete 3 Tickets")
        #expect(BacklogSelectionProjection.deleteTitle(count: 1) == "Delete Ticket")
        #expect(BacklogSelectionProjection.markHeading(count: 3) == "Mark 3 Tickets as")
        #expect(BacklogSelectionProjection.markHeading(count: 1) == "Mark as")
    }

    /// Declared, never discovered by a write coming back refused (ADR-0014): a bare tracker reaches
    /// three states through open-and-closed and can say nothing about the two in between.
    @Test
    func `the mark submenu offers only the states the provider expresses`() {
        let bare = TicketSurface(writes: [.transition], states: [.todo, .done, .closed])

        #expect(BacklogSelectionProjection.markable(bare) == [.todo, .done, .closed])
    }

    /// A provider that writes no transition at all offers no submenu, rather than one full of
    /// items that would each be refused.
    @Test
    func `a provider that writes no transition offers no states`() {
        let readOnly = TicketSurface(writes: [.create], states: [.todo, .inProgress, .done])

        #expect(BacklogSelectionProjection.markable(readOnly).isEmpty)
    }

    /// The menu acts on the whole selection when the pointer's row is in it, and on that row alone
    /// when it is not — sorted, because a set has no order and the report names its Tickets in one.
    @Test
    func `the menu acts on what the pointer's row stands for`() {
        var selection = RowSelection<Int>()
        selection.click(272)
        selection.toggle(607)
        let held = BacklogList.Held(
            picking: .init(selection: .constant(selection)), shut: .constant([]),
        )

        #expect(held.targets(of: 607) == [272, 607])
        #expect(held.targets(of: 819) == [819])
    }

    /// The report names the Tickets that did NOT move, and says the rest did — the load-bearing
    /// half, because a reader who does not know that presses the menu again.
    @Test
    func `a partly refused batch reports which Tickets did not change`() {
        let report = BacklogWriteReport(
            verb: BacklogSelectionProjection.deleteAct,
            refusals: [
                .init(number: 272, reason: "Must have admin access"),
                .init(number: 607, reason: "Must have admin access"),
            ],
        )

        #expect(report.title == "2 Tickets were not changed")
        #expect(report.message.contains("#272"))
        #expect(report.message.contains("#607"))
        #expect(report.message.contains("Everything else in the selection changed"))
    }

    @Test
    func `one refusal is reported in the singular`() {
        let report = BacklogWriteReport(
            verb: BacklogSelectionProjection.markAct(.inProgress),
            refusals: [.init(number: 272, reason: "No status for in progress")],
        )

        #expect(report.title == "One Ticket was not changed")
        #expect(report.message.hasPrefix("The change to In Progress"))
    }
}
