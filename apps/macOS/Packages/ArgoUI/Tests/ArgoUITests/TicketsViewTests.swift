@testable import ArgoUI
import Testing

/// The four backlog views (#812). Their marks are UNCHECKED names from SF Symbols' own catalog: a
/// name it does not carry draws a blank rather than failing, so it is named here or nowhere.
@Suite("Tickets view")
struct TicketsViewTests {
    @Test
    func `every view asks SF Symbols for the shape the design drew`() {
        #expect(TicketsView.allOpen.symbol == "circle.fill")
        #expect(TicketsView.unblocked.symbol == "circle")
        #expect(TicketsView.inProgress.symbol == "diamond.fill")
        #expect(TicketsView.blocked.symbol == "slash.circle.fill")
    }

    /// The mark is what a reader scans the rail by, so two views sharing one would be two rows told
    /// apart by their words alone — which is the job the mark was added to take.
    @Test
    func `no two views draw the same mark`() {
        #expect(Set(TicketsView.allCases.map(\.symbol)).count == TicketsView.allCases.count)
    }

    /// A view name is WRITTEN, and short is the whole reason the sidebar can hold views where it
    /// could not hold ticket titles. Eleven characters is `In progress`, the longest of the four.
    @Test
    func `every view name is short enough for the rail`() {
        for view in TicketsView.allCases {
            #expect(view.name.count <= 11)
        }
    }

    /// No view borrows a room's mark: the strip sits directly above these rows, and one glyph
    /// meaning both a room and a filter inside it is a glyph meaning neither.
    @Test
    func `no view draws a room's mark`() {
        let rooms = Set(CockpitRoom.allCases.map(\.symbol))

        for view in TicketsView.allCases {
            #expect(!rooms.contains(view.symbol))
        }
    }
}
