import ArgoEngine
@testable import ArgoUI
import Testing

/// What the roster spends deciding what an Archive would act on (#1559).
///
/// `archiveTargets(under:aimed:in:)` walks the whole drawn roster, and `swipeable(_:)` called it
/// once per row — so the list paid the roster SQUARED on every update, and rebuilt the drawn array
/// per row on the way in. Sampled on the live cockpit with 405 archived Sessions and ten agents
/// running, that is the heaviest thing Argo's own code does on the main thread: `swipeable` at 286
/// samples, `archiveTargets` at 104, `Row` copies and destroys at 85 and 60, and `String.hash` at
/// 86 — against 46 for the whole root Scene body.
///
/// `ArchiveAim` is built ONCE per pass and every row reads its answer off it, which is O(1) a row
/// by construction: the two sides are settled up front and a row outside the selection never
/// looks at the roster at all.
///
/// **These cases are the safety half, not the speed half.** What they hold is that the answers did
/// not change — the speed is a property of the shape, and the evidence for it is the sample above
/// taken again. A count gate here would need a counter in the projection, which is debt for a
/// claim the sample already makes better.
@Suite("Roster archive aim")
@MainActor
struct RosterArchiveAimTests {
    /// The claim that makes the change safe. Every row's answer, against the walk the view used to
    /// make per row — over a roster carrying both sides of the foot and a selection spanning it,
    /// which is the case the two sides are cut apart for.
    @Test
    func `the aim answers every row exactly as the per-row walk did`() {
        let drawn = Self.roster
        let selection: Set = ["live-1", "live-3", "archived-2"]
        let aim = SessionRosterProjection.ArchiveAim(selection: selection, in: drawn)

        for row in drawn {
            let walked = SessionRosterProjection.archiveTargets(
                under: row,
                aimed: selection.contains(row.id) ? selection : [row.id],
                in: drawn,
            )

            #expect(aim.targets(under: row) == walked)
        }
    }

    /// A row OUTSIDE the selection acts on itself alone, whatever else is selected. The case worth
    /// its own name: getting it wrong archives a reader's whole selection from a row they never
    /// selected.
    @Test
    func `a row outside the selection aims at itself`() throws {
        let drawn = Self.roster
        let aim = SessionRosterProjection.ArchiveAim(selection: ["live-1"], in: drawn)

        #expect(try aim.targets(under: Self.row("live-2", in: drawn)) == ["live-2"])
    }

    /// The two sides stay cut apart: a selection spanning the foot gives the row under the pointer
    /// only its own side, because the menu says one verb and a count.
    @Test
    func `a selection spanning the foot is cut to the row's own side`() throws {
        let drawn = Self.roster
        let aim = SessionRosterProjection.ArchiveAim(
            selection: ["live-1", "archived-2"], in: drawn,
        )

        #expect(try aim.targets(under: Self.row("live-1", in: drawn)) == ["live-1"])
        #expect(try aim.targets(under: Self.row("archived-2", in: drawn)) == ["archived-2"])
    }

    /// A whole-side selection keeps the roster's DRAWN order, which is what the walk it replaces
    /// returned and what the menu's count is read off.
    @Test
    func `a side selected whole comes back in drawn order`() throws {
        let drawn = Self.roster
        let aim = SessionRosterProjection.ArchiveAim(
            selection: ["live-3", "live-1", "live-2"], in: drawn,
        )

        #expect(
            try aim.targets(under: Self.row("live-1", in: drawn)) == ["live-1", "live-2", "live-3"],
        )
    }

    /// Rows either side of the foot, built through the projection rather than by hand: `Row`'s
    /// initializer is `fileprivate`, so `rows(from:)` is the only way one comes into being.
    private static var roster: [SessionRosterProjection.Row] {
        let sessions = (1 ... 3).map { session("live-\($0)", isArchived: false) }
            + (1 ... 3).map { session("archived-\($0)", isArchived: true) }
        return SessionRosterProjection.rows(from: sessions)
            + SessionRosterProjection.archivedRows(from: sessions)
    }

    /// `#require` rather than a force unwrap: a fixture that stopped carrying the row should
    /// name itself, not crash the whole suite from a line that reads like an assertion.
    private static func row(
        _ id: String, in drawn: [SessionRosterProjection.Row],
    ) throws
        -> SessionRosterProjection.Row {
        try #require(drawn.first { $0.id == id })
    }

    private static func session(
        _ id: String, isArchived: Bool,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: id,
            access: .managed,
            status: .idle,
            annotations: .init(isArchived: isArchived),
            transcript: .init(events: []),
        )
    }
}
