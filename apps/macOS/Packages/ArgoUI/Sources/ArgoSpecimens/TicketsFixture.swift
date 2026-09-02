import ArgoEngine
import ArgoUI
import Foundation

/// The backlog the Tickets room renders from (#812) — twelve open tickets, the two closed children
/// that make a parent's roll-up say `2/9`, and the four closed blockers that let a `blockedBy` list
/// name work already finished.
///
/// Twelve, and with the repo's own real titles: the room was chosen over four others by MEASURING
/// titles, and a fixture of short invented ones would render a room that has never been tested.
package enum TicketsFixture {
    package static let reading = reading(showing: 272)

    /// The room the fixture derives to. Held here so a preview of one PART of the room draws from
    /// the same reading the whole room does, rather than from a literal beside it that can drift.
    ///
    /// `@MainActor` because the projection is: it goes through `TicketsRoomMemo`, whose store is
    /// the shell's own and is read on the pass that draws.
    @MainActor
    static let room = TicketsRoomProjection.room(from: reading)

    @MainActor
    static func room(showing number: Int) -> TicketsRoomProjection.Room {
        TicketsRoomProjection.room(from: reading(showing: number))
    }

    /// The same reading with the closed read ANSWERED — what the `Closed` view draws from (#1075).
    ///
    /// A fixture of its own because the absence is the point everywhere else: `reading` above has
    /// closed items in it, for the roll-up, and the `Closed` view still counts absent over them
    /// until a read has landed. Nothing else here reaches the state where it counts at all.
    static let closedRead = closedRead(hasMore: false)

    /// …and the same with a page behind it, which is the only state that draws `Load more`.
    static let closedMore = closedRead(hasMore: true)

    static func closedRead(hasMore: Bool) -> TicketsReading {
        var answered = reading
        answered.closedListing = TicketsReading.ClosedListingReading(
            numbers: Set(answered.items.filter { $0.closure != .open }.map(\.number)),
            hasMore: hasMore,
        )
        return answered
    }

    /// Nothing bound: no provider to name, and no items anybody could have read. The Project is
    /// still named — a window is scoped to one whether or not anything is bound to it.
    package static let unbound = TicketsReading(project: project)

    /// A provider that ANSWERED, and the answer was nothing. Its views stay and read zero, which is
    /// a different page from the one above: conflating the two would tell a reader their backlog is
    /// empty when in fact nobody asked.
    ///
    /// The same twelve tickets, every one of them closed. A reading with no items at all reaches
    /// the same page but loses the charts, and `empty.png` draws them reading zero.
    package static let answeredEmpty = TicketsReading(
        items: items.map(resolved),
        provider: bound,
        project: project,
    )

    /// The same reading scoped to a real Project. The one fact a fixture cannot invent: the window
    /// is opened on a Project of the reader's, and both vacancy pages name it.
    package static func reading(in project: String?) -> TicketsReading {
        var reading = reading
        reading.project = project
        return reading
    }

    /// A provider that exposes NO dependency edges (`edgeless.png`). Every other fact is read; the
    /// blockers are the one thing nobody was told about, and no `Blocked by` section is drawn
    /// anywhere as a result.
    ///
    /// The sidebar's `Unblocked` and `Blocked` counts move with it — a provider that cannot say
    /// what blocks what cannot fill those two views either. The design's own explorable stubbed the
    /// edges out for the detail pane alone, so its render shows the counts unchanged; that is the
    /// prototype's seam rather than a number this build is allowed to invent.
    package static let edgeless: TicketsReading = {
        var stripped = reading(showing: 272)
        stripped.items = stripped.items.map(unedged)
        return stripped
    }()

    /// A ticket the provider named and said nothing else about — no priority, no type, no labels.
    /// The fact strip's floor: `Bucket` is Argo's own and survives, and every absent fact is left
    /// out rather than defaulted.
    package static let unread = TicketsReading(
        items: [Ticket(
            number: 272, title: nodeTreeTitle, status: "Todo", closure: .open, blockedBy: [],
        )],
        provider: bound,
        project: project,
        showing: 272,
    )

    package static func reading(showing: Int) -> TicketsReading {
        TicketsReading(
            items: items,
            claims: TicketClaims(numbers: [388, 609, 763]),
            deliveries: [388: .open, 609: .merged, 275: .failing, 763: .draft],
            deliveryFacts: deliveryFacts,
            provider: bound,
            project: project,
            showing: showing,
        )
    }

    /// Two live Sessions whose own ticket link Argo could not name, so the claim join is SHORT by
    /// two and says so (#1074). The other three views are unaffected: their ground was read.
    ///
    /// A fixture of its own because no other one reaches this state: every reading here sets
    /// `claimed` outright, which asserts every live Session was placed.
    package static let unjoinedClaims = TicketsReading(
        items: items,
        claims: TicketClaims(numbers: [388, 609], unplaced: 2),
        provider: bound,
        project: project,
        showing: 388,
    )

    /// The main reading with #272 claimed as well, which makes it claimed AND blocked — the row no
    /// other fixture reaches (#1074). A delta on `reading` rather than a listing of its own, so the
    /// other three claims cannot drift from the room every other render draws.
    package static var claimedAndBlocked: TicketsReading {
        var reading = reading
        reading.claims = TicketClaims(
            numbers: reading.claims.numbers.union([272]),
            unplaced: reading.claims.unplaced,
            unread: reading.claims.unread,
        )
        return reading
    }

    /// Nothing bound to join against, so no live Session's link could be read at ALL and the count
    /// is genuinely nothing rather than partial. The unread half of the pair above, drawn.
    package static let unreadClaims = TicketsReading(
        items: items,
        claims: TicketClaims(numbers: [], unread: 1),
        provider: bound,
        project: project,
        showing: 388,
    )

    /// Every open leaf waiting on something still open, so the hero has nothing to offer and says
    /// which of the three reasons it is.
    package static let poolBlocked = reading(of: [
        item(272, blockedBy: [TicketBlocker(number: 999, closure: .open)]),
        item(273, blockedBy: [TicketBlocker(number: 999, closure: .open)]),
    ])

    /// The pool is takeable and every one of it is already somebody's. A different sentence from
    /// the one above, and a different day.
    package static let poolRunning = TicketsReading(
        items: [item(272, blockedBy: []), item(273, blockedBy: [])],
        claims: TicketClaims(numbers: [272, 273]),
        provider: bound,
    )

    /// One earned chip: urgent, in no chart, and from a provider that exposed no dependency edge —
    /// so `unblocked` is suppressed rather than asserted. This is the state the room ships in.
    ///
    /// #388's title, which is the one the design's own `one-chip.png` picks and the longest in the
    /// backlog. The hero states ONE ticket, so a fixture whose title fits on one line would render
    /// a card that has never been asked to wrap.
    package static let oneChip = TicketsReading(
        items: [
            Ticket(
                number: 388,
                title: "Ticket read path: listing, status, labels, dependency edges",
                status: "Todo",
                closure: .open,
                priority: "high",
            ),
        ],
        provider: bound,
    )

    /// One item's own reading, for a test that needs a single edge rather than the whole backlog.
    /// Bound, because an unbound room is vacant whatever is in it.
    package static func reading(of items: [Ticket]) -> TicketsReading {
        TicketsReading(items: items, provider: bound, project: project)
    }

    /// The instant every fixture age is counted back from, and the one a render pins
    /// `backlogNow` to. Fixed rather than `.now`: an age stamp measured against the wall clock
    /// makes a render that never matches itself twice, and every shot of a dated row would then be
    /// a shot of a different row.
    package static let asOf = Date(timeIntervalSince1970: 1_760_000_000)

    /// A ticket whose blocker was RULED OUT, so no amount of waiting clears the edge — the state
    /// `state.failure` is spent on (`cockpit-work-room.md` — the Route).
    ///
    /// A fixture of its own because no other one reaches it: every blocker in the backlog above is
    /// either open or resolved, so the stranded mark had no render anywhere until this one.
    package static let stranded = reading(of: [
        item(272, blockedBy: [
            TicketBlocker(number: 609, closure: .ruledOut),
            TicketBlocker(number: 388, closure: .open),
        ]),
        item(273, blockedBy: [TicketBlocker(number: 999, closure: .ruledOut)]),
        item(275, blockedBy: []),
    ])

    package static let bound = TicketsProvider(
        name: "GitHub",
        account: "milad-alizadeh",
        state: .idle,
        hasAnswered: true,
    )

    /// The Project the design's renders are shot in — this repo, by the name the window carries.
    package static let project = "argo"

    /// The Binding behind `bound`, addressed — what the room's two link verbs are drawn live off
    /// (#872). The repo the titles above were taken from, so a render's link goes where it says.
    package static let address = TicketAddress(provider: .github, scope: "milad-alizadeh/argo")

    package static func item(_ number: Int, blockedBy: [TicketBlocker]) -> Ticket {
        Ticket(
            number: number, title: "A ticket behind an edge", status: "Todo", closure: .open,
            blockedBy: blockedBy,
        )
    }

    /// The same ticket from a provider that serves no dependency summary: the edges are not empty,
    /// they are UNREAD, and every claim built on them is suppressed above this.
    private static func unedged(_ item: Ticket) -> Ticket {
        Ticket(copying: item, blockedBy: .some(nil))
    }
}
