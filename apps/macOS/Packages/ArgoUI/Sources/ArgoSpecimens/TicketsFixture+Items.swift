import ArgoEngine
import ArgoUI
import Foundation

extension TicketsFixture {
    /// What varies between one fixture ticket and the next. A struct rather than three more
    /// parameters: the cap is four, and a defaulted parameter still spends one.
    package struct Shape {
        var status = "Todo"
        var blockedBy: [Int] = []
        var children: [Int] = []
        var labels: [String] = []
    }

    /// Twelve open tickets in the provider's own order, the two closed children that make #607's
    /// roll-up read `2/9` without either of them being drawn, and the four closed tickets its
    /// `blockedBy` list names.
    ///
    /// #607 carries nine children: five open and read, two closed and read, and two the poll has
    /// not reached — the three states a roll-up has to survive. Its six blockers are the other
    /// worst honest case: two still open, four already closed and named from the tracker.
    package static let items: [Ticket] = listed.map(carrying)

    private static let listed: [Ticket] = [
        open(
            607,
            "Wayfinder: the Tickets room, end to end",
            .init(
                blockedBy: [609, 388, 264, 256, 375, 376],
                children: [609, 388, 272, 273, 334, 690, 745, 805, 813],
                labels: ["wayfinder", "work-room", "prd"],
            ),
        ),
        open(
            609,
            "Prototype: what the Tickets room looks like in the Liquid Glass shell",
            .init(status: working, labels: ["design", "work-room"]),
        ),
        open(
            388,
            "Ticket read path: listing, status, labels, dependency edges",
            .init(status: working),
        ),
        open(
            272, nodeTreeTitle,
            .init(blockedBy: [609, 388], labels: ["work-room", "ui", "blocked"]),
        ),
        open(273, "The Next-up cold-start planner"),
        open(
            334,
            "The Route — a progress-axis view of a ticket and its children",
            .init(blockedBy: [272], children: [335, 336]),
        ),
        open(335, "Placement: zones, columns and the cycle guard", .init(blockedBy: [334])),
        open(336, "The canvas: derived spacing and the edge rule", .init(blockedBy: [335])),
        open(763, "Ticket transport and grant plumbing", .init(status: working)),
        open(275, "The provider connection chip as a graphite transient", .init(blockedBy: [272])),
        open(160, "Ticket vocabulary: type is a property, not a ladder", .init(blockedBy: [272])),
        open(185, "Tickets room interior: what a leaf carries", .init(blockedBy: [272])),
        closed(690, "A room tab is its mark alone"),
        closed(745, "Name a roster row by the ticket it is working"),
        closed(264, "App shell: project strip, top bar, room tabs"),
        closed(256, "Ticket provider port over OAuth (Electron)"),
        closed(375, "The graphite/Ion visual foundation"),
        closed(376, "The native Liquid Glass shell"),
        // The one RULED OUT, so the `Closed` view has both of its words to draw and no render can
        // pass while folding the two into one (#1075). Deliberately named by nothing — no blocker
        // edge and no child edge reaches it, so it cannot strand a parent or move a roll-up.
        closed(186, "A status ladder across providers", .ruledOut),
    ]

    /// #272's title, which two fixtures name it by.
    package static let nodeTreeTitle = "The generic node tree and ticket detail"

    /// The body #272 opens on. Prose only: `deep.png` draws an `Acceptance criteria` heading in
    /// it, but that is the provider's own Markdown and nothing renders one yet — the sections
    /// below the body are what `bodyHeading` (#813) has a caller for.
    package static let body = """
    The backlog's home, with the sidebar freed: views at 280, the backlog at 520 where a title \
    reads whole at depth three, and the ticket beside it.

    Any node — parent or leaf — opens in detail through the same view; type is a property rather \
    than a rung of a ladder. A parent adds a Children section to that same view, and no Implement \
    action appears anywhere on one: work happens at leaves.
    """

    /// #607's own body, so the render of a PARENT is a parent's page rather than a leaf's prose
    /// under a parent's title.
    ///
    /// It carries MARKS where `body` above is prose, and the pair is the point: a tracker's bodies
    /// are markdown, so one fixture has to prove the heading, the list and the code span reach the
    /// pane's renderer and one has to prove a paragraph on its own still sets as one.
    package static let parentBody = """
    The Tickets room, end to end: the views sidebar, the backlog in the deck, the ticket \
    beside it, and the Route a parent opens onto.

    ## What carries it

    Nine children. Two are closed and two the poll has not reached, which is why the roll-up \
    beside this ticket counts more than the rows nested under it.

    - The sidebar's counts are arithmetic over the same list the deck draws.
    - `TicketsRoomProjection.room(from:in:)` is where both halves are assembled.
    """

    /// How long before `TicketsFixture.asOf` the provider last saw each ticket change (#897).
    ///
    /// A SPREAD across every rung of the stamp — hours, days, weeks, months, a year — because a
    /// column where seventy-five rows all read `3d` proves the stamp compiles and nothing else.
    /// It is also what puts all four states of the trailing region in one shot: #609 is dated and
    /// clear, #336 is dated and blocked, #272 is BOTH blocked and stale, and #763 is neither —
    /// deliberately absent, so one row in every render is a row the provider served no date for.
    /// #607's date is drawn over by its own roll-up, which is the precedence rule rendered rather
    /// than asserted.
    private static let daysUntouched: [Int: Double] = [
        336: 2 / 24.0, 609: 1, 607: 3, 388: 5, 275: 8, 272: 12, 334: 21, 273: 40, 185: 60,
        335: 95, 160: 400,
        // The closed ones, dated so the `Closed` view has a recency to order BY (#1075) — the
        // stamp is `updatedAt` and says last touched, never closed at: no adapter reads a
        // closed-at date (#897). Interleaved with the open ages on purpose, so a render of the
        // closed list is visibly not in number order.
        690: 4, 745: 9, 264: 16, 186: 30, 256: 55, 375: 120, 376: 200,
    ]

    /// The provider's own word for a ticket somebody is on. Verbatim, and deliberately not
    /// `TicketState.claimed`'s spelling — the two are different facts (#272).
    private static let working = "In progress"

    /// Which fixture numbers are closed. A blocker's closure is read from here rather than written
    /// beside each edge, so an item cannot be closed in one list and open in the other.
    private static let closedNumbers: Set<Int> = [690, 745, 264, 256, 375, 376]

    /// A fixture label in a colour a tracker plausibly serves. GitHub's own defaults where the name
    /// is one of GitHub's; the rest are picked to spread across the wheel, because what these
    /// renders have to show is chips a reader can tell apart. `work-room` is deliberately left
    /// colourless — the neutral chip is a state as real as the coloured one, and no render would
    /// show it if every fixture label had a hue.
    private static func labelled(_ name: String) -> TicketLabel {
        TicketLabel(name: name, colour: labelColours[name])
    }

    private static let labelColours: [String: String] = [
        "bug": "d73a4a",
        "enhancement": "a2eeef",
        "design": "d876e3",
        "prd": "0e8a16",
        "ui": "1d76db",
        "wayfinder": "5319e7",
        "blocked": "b60205",
    ]

    private static func open(_ number: Int, _ title: String, _ shape: Shape = Shape()) -> Ticket {
        Ticket(
            number: number, title: title, status: shape.status, closure: .open,
            labels: shape.labels.map(labelled),
            children: shape.children,
            blockedBy: shape.blockedBy.map {
                TicketBlocker(number: $0, closure: closedNumbers.contains($0) ? .resolved : .open)
            },
        )
    }

    /// The provider's own word follows the closure it is a word FOR — a row reading `ruled out`
    /// beside a status of `Done` would be the fixture contradicting itself.
    private static func closed(
        _ number: Int, _ title: String, _ closure: TicketClosure = .resolved,
    )
        -> Ticket {
        Ticket(
            number: number,
            title: title,
            status: closure == .ruledOut ? "Not planned" : "Done",
            closure: closure,
            blockedBy: [],
        )
    }

    /// The same ticket, finished. Everything but the status word survives: a closed parent still
    /// has the children a chart counts, and closing a ticket does not strip its labels.
    package static func resolved(_ item: Ticket) -> Ticket {
        Ticket(copying: item, status: "Done", closure: .resolved)
    }

    /// The same ticket carrying the facts one listing request answers alongside it — the provider's
    /// own priority and type words, and the body of the two tickets a render opens on.
    private static func carrying(_ item: Ticket) -> Ticket {
        Ticket(
            copying: item,
            priority: priorities[item.number],
            type: types[item.number],
            body: bodies[item.number],
            updatedAt: .some(daysUntouched[item.number].map(untouched)),
        )
    }

    /// One age as an instant, counted back off the fixture's own fixed `asOf` — so a render pinned
    /// to that instant shows the same stamps in a year's time as it does today.
    private static func untouched(_ days: Double) -> Date {
        asOf.addingTimeInterval(-days * 86400)
    }
}
