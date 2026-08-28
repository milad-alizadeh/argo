import ArgoEngine

extension WorkFixture {
    /// What varies between one fixture ticket and the next. A struct rather than three more
    /// parameters: the cap is four, and a defaulted parameter still spends one.
    struct Shape {
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
    static let items: [WorkItem] = listed.map(carrying)

    private static let listed: [WorkItem] = [
        open(
            607,
            "Wayfinder: the Work room, end to end",
            .init(
                blockedBy: [609, 388, 264, 256, 375, 376],
                children: [609, 388, 272, 273, 334, 690, 745, 805, 813],
                labels: ["wayfinder", "work-room", "prd"],
            ),
        ),
        open(
            609,
            "Prototype: what the Work room looks like in the Liquid Glass shell",
            .init(status: working, labels: ["design", "work-room"]),
        ),
        open(
            388,
            "Work Item read path: listing, status, labels, dependency edges",
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
        open(763, "WorkItem transport and grant plumbing", .init(status: working)),
        open(275, "The provider connection chip as a graphite transient", .init(blockedBy: [272])),
        open(160, "Ticket vocabulary: type is a property, not a ladder", .init(blockedBy: [272])),
        open(185, "Work room interior: what a leaf carries", .init(blockedBy: [272])),
        closed(690, "A room tab is its mark alone"),
        closed(745, "Name a roster row by the ticket it is working"),
        closed(264, "App shell: project strip, top bar, room tabs"),
        closed(256, "Work Item provider port over OAuth (Electron)"),
        closed(375, "The graphite/Ion visual foundation"),
        closed(376, "The native Liquid Glass shell"),
    ]

    /// #272's title, which two fixtures name it by.
    static let nodeTreeTitle = "The generic node tree and ticket detail"

    /// The body #272 opens on. Prose only: `deep.png` draws an `Acceptance criteria` heading in
    /// it, but that is the provider's own Markdown and nothing renders one yet — the sections
    /// below the body are what `bodyHeading` (#813) has a caller for.
    static let body = """
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
    static let parentBody = """
    The Work room, end to end: the views sidebar, the backlog in the deck, the ticket beside it, \
    and the Route a parent opens onto.

    ## What carries it

    Nine children. Two are closed and two the poll has not reached, which is why the roll-up \
    beside this ticket counts more than the rows nested under it.

    - The sidebar's counts are arithmetic over the same list the deck draws.
    - `WorkRoomProjection.room(from:in:)` is where both halves are assembled.
    """

    /// The provider's own word for a ticket somebody is on. Verbatim, and deliberately not
    /// `WorkItemState.claimed`'s spelling — the two are different facts (#272).
    private static let working = "In progress"

    /// Which fixture numbers are closed. A blocker's closure is read from here rather than written
    /// beside each edge, so an item cannot be closed in one list and open in the other.
    private static let closedNumbers: Set<Int> = [690, 745, 264, 256, 375, 376]

    private static func open(_ number: Int, _ title: String, _ shape: Shape = Shape()) -> WorkItem {
        WorkItem(
            number: number, title: title, status: shape.status, closure: .open,
            labels: shape.labels,
            children: shape.children,
            blockedBy: shape.blockedBy.map {
                WorkItemBlocker(number: $0, closure: closedNumbers.contains($0) ? .resolved : .open)
            },
        )
    }

    private static func closed(_ number: Int, _ title: String) -> WorkItem {
        WorkItem(
            number: number,
            title: title,
            status: "Done",
            closure: .resolved,
            blockedBy: [],
        )
    }

    /// The same ticket, finished. Everything but the status word survives: a closed parent still
    /// has the children a chart counts, and closing a ticket does not strip its labels.
    static func resolved(_ item: WorkItem) -> WorkItem {
        WorkItem(copying: item, status: "Done", closure: .resolved)
    }

    /// The same ticket carrying the facts one listing request answers alongside it — the provider's
    /// own priority and type words, and the body of the two tickets a render opens on.
    private static func carrying(_ item: WorkItem) -> WorkItem {
        WorkItem(
            copying: item,
            priority: priorities[item.number],
            type: types[item.number],
            body: bodies[item.number],
        )
    }
}
