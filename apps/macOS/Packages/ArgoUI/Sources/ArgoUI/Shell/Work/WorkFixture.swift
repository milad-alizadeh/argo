import ArgoEngine

/// The backlog the Work room renders from (#812) — twelve open tickets and the two closed children
/// that make a parent's roll-up say `2/9`.
///
/// Twelve, and with the repo's own real titles: the room was chosen over four others by MEASURING
/// titles, and a fixture of short invented ones would render a room that has never been tested.
enum WorkFixture {
    static let reading = reading(showing: 272)

    /// The room the fixture derives to. Held here so a preview of one PART of the room draws from
    /// the same reading the whole room does, rather than from a literal beside it that can drift.
    static let room = WorkRoomProjection.room(from: reading)

    /// Nothing bound: no provider to name, and no items anybody could have read.
    static let unbound = WorkReading()

    /// A provider that ANSWERED, and the answer was nothing. Its views stay and read zero, which is
    /// a different page from the one above: conflating the two would tell a reader their backlog is
    /// empty when in fact nobody asked.
    static let answeredEmpty = WorkReading(provider: bound)

    static func reading(showing: Int) -> WorkReading {
        WorkReading(
            items: items,
            claimed: [388, 609, 763],
            deliveries: [388: .open, 609: .merged, 275: .failing, 763: .draft],
            bodies: [272: body],
            charts: [607, 334],
            provider: bound,
            showing: showing,
        )
    }

    /// One item's own reading, for a test that needs a single edge rather than the whole backlog.
    /// Bound, because an unbound room is vacant whatever is in it.
    static func reading(of items: [WorkItem]) -> WorkReading {
        WorkReading(items: items, provider: bound)
    }

    static let bound = WorkProvider(name: "GitHub", account: "milad-alizadeh", state: .idle)

    static func item(_ number: Int, blockedBy: [WorkItemBlocker]) -> WorkItem {
        WorkItem(
            number: number, title: "A ticket behind an edge", status: "Todo", closure: .open,
            blockedBy: blockedBy,
        )
    }
}
