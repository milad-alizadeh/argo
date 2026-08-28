import ArgoEngine
import Foundation

/// The backlog the Tickets room renders from (#812) — twelve open tickets, the two closed children
/// that make a parent's roll-up say `2/9`, and the four closed blockers that let a `blockedBy` list
/// name work already finished.
///
/// Twelve, and with the repo's own real titles: the room was chosen over four others by MEASURING
/// titles, and a fixture of short invented ones would render a room that has never been tested.
enum TicketsFixture {
    static let reading = reading(showing: 272)

    /// The room the fixture derives to. Held here so a preview of one PART of the room draws from
    /// the same reading the whole room does, rather than from a literal beside it that can drift.
    static let room = TicketsRoomProjection.room(from: reading)

    static func room(showing number: Int) -> TicketsRoomProjection.Room {
        TicketsRoomProjection.room(from: reading(showing: number))
    }

    /// Nothing bound: no provider to name, and no items anybody could have read. The Project is
    /// still named — a window is scoped to one whether or not anything is bound to it.
    static let unbound = TicketsReading(project: project)

    /// A provider that ANSWERED, and the answer was nothing. Its views stay and read zero, which is
    /// a different page from the one above: conflating the two would tell a reader their backlog is
    /// empty when in fact nobody asked.
    ///
    /// The same twelve tickets, every one of them closed. A reading with no items at all reaches
    /// the same page but loses the charts, and `empty.png` draws them reading zero.
    static let answeredEmpty = TicketsReading(
        items: items.map(resolved),
        provider: bound,
        project: project,
    )

    /// The same reading scoped to a real Project. The one fact a fixture cannot invent: the window
    /// is opened on a Project of the reader's, and both vacancy pages name it.
    static func reading(in project: String?) -> TicketsReading {
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
    static let edgeless: TicketsReading = {
        var stripped = reading(showing: 272)
        stripped.items = stripped.items.map(unedged)
        return stripped
    }()

    /// A ticket the provider named and said nothing else about — no priority, no type, no labels.
    /// The fact strip's floor: `Bucket` is Argo's own and survives, and every absent fact is left
    /// out rather than defaulted.
    static let unread = TicketsReading(
        items: [Ticket(
            number: 272, title: nodeTreeTitle, status: "Todo", closure: .open, blockedBy: [],
        )],
        provider: bound,
        project: project,
        showing: 272,
    )

    static func reading(showing: Int) -> TicketsReading {
        TicketsReading(
            items: items,
            claimed: [388, 609, 763],
            deliveries: [388: .open, 609: .merged, 275: .failing, 763: .draft],
            deliveryFacts: deliveryFacts,
            provider: bound,
            project: project,
            showing: showing,
        )
    }

    /// A live Session on the machine whose own ticket link Argo could not name (#894) — so the
    /// claim join is INCOMPLETE and `In progress` counts nothing rather than counting the two it
    /// could see. The other three views are unaffected: their ground was read.
    ///
    /// A fixture of its own because no other one reaches this state: every reading here sets
    /// `claimed` outright, which asserts the join was whole. No render had ever drawn the absent
    /// count until this one.
    static let unjoinedClaims = TicketsReading(
        items: items,
        claimed: [388, 609],
        claimsAreWhole: false,
        provider: bound,
        project: project,
        showing: 388,
    )

    /// Every open leaf waiting on something still open, so the hero has nothing to offer and says
    /// which of the three reasons it is.
    static let poolBlocked = reading(of: [
        item(272, blockedBy: [TicketBlocker(number: 999, closure: .open)]),
        item(273, blockedBy: [TicketBlocker(number: 999, closure: .open)]),
    ])

    /// The pool is takeable and every one of it is already somebody's. A different sentence from
    /// the one above, and a different day.
    static let poolRunning = TicketsReading(
        items: [item(272, blockedBy: []), item(273, blockedBy: [])],
        claimed: [272, 273],
        provider: bound,
    )

    /// One earned chip: urgent, in no chart, and from a provider that exposed no dependency edge —
    /// so `unblocked` is suppressed rather than asserted. This is the state the room ships in.
    ///
    /// #388's title, which is the one the design's own `one-chip.png` picks and the longest in the
    /// backlog. The hero states ONE ticket, so a fixture whose title fits on one line would render
    /// a card that has never been asked to wrap.
    static let oneChip = TicketsReading(
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
    static func reading(of items: [Ticket]) -> TicketsReading {
        TicketsReading(items: items, provider: bound, project: project)
    }

    /// The instant every fixture age is counted back from, and the one a render pins
    /// `backlogNow` to. Fixed rather than `.now`: an age stamp measured against the wall clock
    /// makes a render that never matches itself twice, and every shot of a dated row would then be
    /// a shot of a different row.
    static let asOf = Date(timeIntervalSince1970: 1_760_000_000)

    /// A ticket whose blocker was RULED OUT, so no amount of waiting clears the edge — the state
    /// `state.failure` is spent on (`cockpit-work-room.md` — the Route).
    ///
    /// A fixture of its own because no other one reaches it: every blocker in the backlog above is
    /// either open or resolved, so the stranded mark had no render anywhere until this one.
    static let stranded = reading(of: [
        item(272, blockedBy: [
            TicketBlocker(number: 609, closure: .ruledOut),
            TicketBlocker(number: 388, closure: .open),
        ]),
        item(273, blockedBy: [TicketBlocker(number: 999, closure: .ruledOut)]),
        item(275, blockedBy: []),
    ])

    static let bound = TicketsProvider(
        name: "GitHub",
        account: "milad-alizadeh",
        state: .idle,
        hasAnswered: true,
    )

    /// The Project the design's renders are shot in — this repo, by the name the window carries.
    static let project = "argo"

    /// The Binding behind `bound`, addressed — what the room's two link verbs are drawn live off
    /// (#872). The repo the titles above were taken from, so a render's link goes where it says.
    static let address = TicketAddress(provider: .github, scope: "milad-alizadeh/argo")

    static func item(_ number: Int, blockedBy: [TicketBlocker]) -> Ticket {
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
