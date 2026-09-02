@testable import ArgoEngine
import Testing

/// What opening the `Closed` view and pressing `Load more` do to what the room reads from (#1075).
///
/// The poll's listing is open-only and is replaced whole on every tick. The closed listing is
/// neither: it is the reader's, a page at a time, and no cadence touches it.
@Suite("Reading the closed listing")
struct ClosedTicketReadingTests {
    private static let project = "argo"

    private static func closed(_ number: Int) -> Ticket {
        Ticket(number: number, title: "App shell", status: "closed", closure: .resolved)
    }

    private static func page(_ numbers: [Int], next: String? = nil) -> ClosedTicketPage {
        ClosedTicketPage(items: numbers.map(closed), next: next)
    }

    // MARK: - The ledger

    /// Absent and empty are DIFFERENT answers here, which is what lets the view count absent rather
    /// than open onto a `0` claiming the reader has finished nothing.
    @Test
    func `a Project nobody has opened the view on has no closed listing at all`() async {
        let items = TicketLedger()

        #expect(await items.closedListing(of: Self.project) == nil)
        #expect(await items.closedListing(of: nil) == nil)
    }

    @Test
    func `opening replaces the listing, and the cursor with it`() async {
        let items = TicketLedger()
        await items.openClosed(Self.page([9, 8], next: "2"), for: Self.project)

        await items.openClosed(Self.page([9], next: nil), for: Self.project)

        let listing = await items.closedListing(of: Self.project)
        #expect(listing?.items.map(\.number) == [9])
        #expect(listing?.hasMore == false)
    }

    @Test
    func `the next page is appended, not swapped in`() async {
        let items = TicketLedger()
        await items.openClosed(Self.page([9, 8], next: "2"), for: Self.project)

        await items.extendClosed(Self.page([7, 6], next: "3"), for: Self.project)

        let listing = await items.closedListing(of: Self.project)
        #expect(listing?.items.map(\.number) == [9, 8, 7, 6])
        #expect(listing?.next == "3")
    }

    /// Two presses racing on one cursor is a double-read, not a reason to draw a ticket twice.
    @Test
    func `a number already held is not appended again`() async {
        let items = TicketLedger()
        await items.openClosed(Self.page([9, 8], next: "2"), for: Self.project)

        await items.extendClosed(Self.page([8, 7], next: nil), for: Self.project)

        #expect(await items.closedListing(of: Self.project)?.items.map(\.number) == [9, 8, 7])
    }

    /// A cursor with no first page behind it is not a listing, and inventing one would make the
    /// view's count an answer before it is.
    @Test
    func `extending a listing that was never opened lands nothing`() async {
        let items = TicketLedger()

        await items.extendClosed(Self.page([9]), for: Self.project)

        #expect(await items.closedListing(of: Self.project) == nil)
    }

    // MARK: - What the room reads

    /// #895's residue: `rollUp` counts the children a parent's tracker holds, and an OPEN parent's
    /// `n/m` is only right once the closed children are in hand.
    @Test
    func `the closed listing joins the items the room derives from`() async {
        let items = TicketLedger()
        await items.record([Ticket(
            number: 607, title: "The Tickets room", status: "open", closure: .open,
        )], for: Self.project)

        await items.openClosed(Self.page([264, 263]), for: Self.project)

        #expect(await items.items(of: Self.project).map(\.number) == [607, 264, 263])
    }

    /// The listing is the fresher of the two — it was read this tick, where a closed page was read
    /// when the view was last opened — so a number in both is the poll's.
    @Test
    func `a number the poll has since listed is counted once, as the poll's`() async {
        let items = TicketLedger()
        await items.openClosed(Self.page([264]), for: Self.project)

        await items.record(
            [Ticket(number: 264, title: "Reopened", status: "open", closure: .open)],
            for: Self.project,
        )

        #expect(await items.items(of: Self.project).map(\.title) == ["Reopened"])
    }

    @Test
    func `one Project's closed listing is not another's`() async {
        let items = TicketLedger()

        await items.openClosed(Self.page([264]), for: Self.project)

        #expect(await items.closedListing(of: "other") == nil)
        #expect(await items.items(of: "other").isEmpty)
    }
}
