import ArgoEngine

extension WorkFixture {
    /// What varies between one fixture ticket and the next. A struct rather than three more
    /// parameters: the cap is four, and a defaulted parameter still spends one.
    struct Shape {
        var status = "Todo"
        var blocked = false
        var children: [Int] = []
    }

    /// Twelve open tickets in the provider's own order, and the two closed children that make
    /// #607's roll-up read `2/9` without either of them being drawn.
    ///
    /// #607 carries nine children: five open and read, two closed and read, and two the poll has
    /// not reached — the three states a roll-up has to survive.
    static let items: [WorkItem] = [
        open(
            607,
            "Wayfinder: the Work room, end to end",
            .init(blocked: true, children: [609, 388, 272, 273, 334, 690, 745, 805, 813]),
        ),
        open(
            609,
            "Prototype: what the Work room looks like in the Liquid Glass shell",
            .init(status: working),
        ),
        open(
            388,
            "Work Item read path: listing, status, labels, dependency edges",
            .init(status: working),
        ),
        open(272, "The generic node tree and ticket detail", .init(blocked: true)),
        open(273, "The Next-up cold-start planner"),
        open(
            334,
            "The Route — a progress-axis view of a ticket and its children",
            .init(blocked: true, children: [335, 336]),
        ),
        open(335, "Placement: zones, columns and the cycle guard", .init(blocked: true)),
        open(336, "The canvas: derived spacing and the edge rule", .init(blocked: true)),
        open(763, "WorkItem transport and grant plumbing", .init(status: working)),
        open(275, "The provider connection chip as a graphite transient", .init(blocked: true)),
        open(160, "Ticket vocabulary: type is a property, not a ladder", .init(blocked: true)),
        open(185, "Work room interior: what a leaf carries", .init(blocked: true)),
        closed(690, "A room tab is its mark alone"),
        closed(745, "Name a roster row by the ticket it is working"),
    ]

    /// The body #272 opens on. Prose only: the body's own section headings are #813's, and a
    /// fixture that set them here would render a role the contract does not have yet.
    static let body = """
    The backlog's home, with the sidebar freed: views at 280, the backlog at 520 where a title \
    reads whole at depth three, and the ticket beside it.

    Any node — parent or leaf — opens in detail through the same view; type is a property rather \
    than a rung of a ladder. A parent adds a Children section to that same view, and no Implement \
    action appears anywhere on one: work happens at leaves.
    """

    /// The provider's own word for a ticket somebody is on. Verbatim, and deliberately not
    /// `WorkItemState.claimed`'s spelling — the two are different facts (#272).
    private static let working = "In progress"

    private static func open(_ number: Int, _ title: String, _ shape: Shape = Shape()) -> WorkItem {
        WorkItem(
            number: number, title: title, status: shape.status, closure: .open,
            children: shape.children,
            blockedBy: shape.blocked ? [WorkItemBlocker(number: 999, closure: .open)] : [],
        )
    }

    private static func closed(_ number: Int, _ title: String) -> WorkItem {
        WorkItem(number: number, title: title, status: "Done", closure: .resolved)
    }
}
