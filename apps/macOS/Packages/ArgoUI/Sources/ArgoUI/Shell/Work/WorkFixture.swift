import ArgoEngine

/// The backlog the Work room renders from (#812) — twelve open tickets, the two closed children
/// that make a parent's roll-up say `2/9`, and the four closed blockers that let a `blockedBy` list
/// name work already finished.
///
/// Twelve, and with the repo's own real titles: the room was chosen over four others by MEASURING
/// titles, and a fixture of short invented ones would render a room that has never been tested.
enum WorkFixture {
    static let reading = reading(showing: 272)

    /// The room the fixture derives to. Held here so a preview of one PART of the room draws from
    /// the same reading the whole room does, rather than from a literal beside it that can drift.
    static let room = WorkRoomProjection.room(from: reading)

    static func room(showing number: Int) -> WorkRoomProjection.Room {
        WorkRoomProjection.room(from: reading(showing: number))
    }

    /// Nothing bound: no provider to name, and no items anybody could have read. The Project is
    /// still named — a window is scoped to one whether or not anything is bound to it.
    static let unbound = WorkReading(project: project)

    /// A provider that ANSWERED, and the answer was nothing. Its views stay and read zero, which is
    /// a different page from the one above: conflating the two would tell a reader their backlog is
    /// empty when in fact nobody asked.
    ///
    /// The same twelve tickets, every one of them closed. A reading with no items at all reaches
    /// the same page but loses the charts, and `empty.png` draws them reading zero.
    static let answeredEmpty = WorkReading(
        items: items.map(resolved),
        charts: [607, 334],
        provider: bound,
        project: project,
    )

    /// The same reading scoped to a real Project. The one fact a fixture cannot invent: the window
    /// is opened on a Project of the reader's, and both vacancy pages name it.
    static func reading(in project: String?) -> WorkReading {
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
    static let edgeless: WorkReading = {
        var stripped = reading(showing: 272)
        stripped.items = stripped.items.map(unedged)
        return stripped
    }()

    /// A ticket the provider named and said nothing else about — no priority, no type, no labels.
    /// The fact strip's floor: `Bucket` is Argo's own and survives, and every absent fact is left
    /// out rather than defaulted.
    static let unread = WorkReading(
        items: [WorkItem(number: 272, title: nodeTreeTitle, status: "Todo", closure: .open)],
        provider: bound,
        project: project,
        showing: 272,
    )

    static func reading(showing: Int) -> WorkReading {
        WorkReading(
            items: items,
            claimed: [388, 609, 763],
            edgesRead: Set(items.map(\.number)),
            deliveries: [388: .open, 609: .merged, 275: .failing, 763: .draft],
            deliveryFacts: deliveryFacts,
            priorities: priorities,
            types: types,
            bodies: [272: body, 607: body],
            charts: [607, 334],
            provider: bound,
            project: project,
            showing: showing,
        )
    }

    /// Every open leaf waiting on something still open, so the hero has nothing to offer and says
    /// which of the three reasons it is.
    static let poolBlocked = reading(of: [
        item(272, blockedBy: [WorkItemBlocker(number: 999, closure: .open)]),
        item(273, blockedBy: [WorkItemBlocker(number: 999, closure: .open)]),
    ])

    /// The pool is takeable and every one of it is already somebody's. A different sentence from
    /// the one above, and a different day.
    static let poolRunning = WorkReading(
        items: [item(272, blockedBy: []), item(273, blockedBy: [])],
        claimed: [272, 273],
        edgesRead: [272, 273],
        provider: bound,
    )

    /// One earned chip: urgent, in no chart, and from a provider that exposed no dependency edge —
    /// so `unblocked` is suppressed rather than asserted. This is the state the room ships in.
    ///
    /// #388's title, which is the one the design's own `one-chip.png` picks and the longest in the
    /// backlog. The hero states ONE ticket, so a fixture whose title fits on one line would render
    /// a card that has never been asked to wrap.
    static let oneChip = WorkReading(
        items: [
            WorkItem(
                number: 388,
                title: "Work Item read path: listing, status, labels, dependency edges",
                status: "Todo",
                closure: .open,
            ),
        ],
        priorities: [388: "high"],
        provider: bound,
    )

    /// One item's own reading, for a test that needs a single edge rather than the whole backlog.
    /// Bound, because an unbound room is vacant whatever is in it.
    static func reading(of items: [WorkItem]) -> WorkReading {
        WorkReading(items: items, provider: bound, project: project)
    }

    static let bound = WorkProvider(name: "GitHub", account: "milad-alizadeh", state: .idle)

    /// The Project the design's renders are shot in — this repo, by the name the window carries.
    static let project = "argo"

    static func item(_ number: Int, blockedBy: [WorkItemBlocker]) -> WorkItem {
        WorkItem(
            number: number, title: "A ticket behind an edge", status: "Todo", closure: .open,
            blockedBy: blockedBy,
        )
    }

    private static func unedged(_ item: WorkItem) -> WorkItem {
        WorkItem(
            number: item.number, title: item.title, status: item.status, closure: item.closure,
            labels: item.labels, children: item.children,
        )
    }
}
