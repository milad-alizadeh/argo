import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import CoreGraphics
import Testing

/// Which of the row's three lines each fact is on (#1343, `cockpit-roster-row.md`).
@Suite("The roster row's three lines")
struct SessionRowLinesTests {
    @Test
    func `a Session with something to say fills line 2`() throws {
        let row = try #require(rows(status: .running, events: [ran("bun run quality")]).first)

        #expect(row.secondaryFact == "Ran bun run quality")
    }

    @Test
    func `a Session with nothing to say draws no line 2`() throws {
        #expect(try rowWithNothingToSay().secondaryFact == nil)
    }

    /// The clock left line 2 for line 3 and does not come back to it, so a row that draws no
    /// line 2 still draws its clock.
    @Test
    func `the clock is there whether or not line 2 is drawn`() throws {
        let running = try #require(rows(status: .running, events: [ran("swift test")]).first)

        #expect(running.clock != nil)
        #expect(try rowWithNothingToSay().clock != nil)
    }

    /// A fold's own second line is the folder it stands for, which is why line 2 goes on an empty
    /// slot rather than on an absent activity.
    @Test
    func `a fold fills line 2 with the folder it stands for`() throws {
        let row = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            RosterSessionFixture.session(
                id: "headless-\(index)",
                workspaceLocation: RosterSessionFixture.checkout,
                access: .external,
                entry: .headless,
                status: .running,
                lastSeenAtMs: 0,
            )
        }).first { $0.fold != nil })

        #expect(row.secondaryFact == row.fold?.label)
    }

    /// A title already carrying both the command and the number, so `toldApart` says nothing
    /// either: the slot is empty rather than merely activity-less.
    private func rowWithNothingToSay() throws -> SessionRosterProjection.Row {
        try #require(SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(
                id: "one", title: "/implement 1343", status: .idle, lastSeenAtMs: 0,
            ),
        ]).first)
    }

    private func rows(status: SessionStatus, events: [TranscriptEvent])
        -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(
                id: "one", title: "/implement 1343", status: status, lastSeenAtMs: 0,
                events: events,
            ),
        ])
    }

    private func ran(_ command: String) -> TranscriptEvent {
        .toolCall(ToolCall(id: "one", name: "Bash", kind: .execute, target: command, atMs: nil))
    }
}

/// Where the leading column puts its mark. Every case reads the offset off the type role, which is
/// the point: a mark aligned by a magic number drifts the moment the scale moves.
@MainActor
@Suite("The roster marker's centring")
struct SessionMarkerTests {
    @Test(arguments: [ArgoIconSize.statusDot, ArgoIconSize.chevron.rawValue])
    func `a mark's centre lands on the title's centre`(mark: CGFloat) {
        let centre = SessionMarker.inset(for: mark) + mark / 2

        #expect(abs(centre - SessionMarker.titleLineBox / 2) < 0.001)
    }

    /// The box the centring is measured in, so a later edit cannot keep the arithmetic while
    /// swapping the drawn line for the ladder's nominal number — a different value, and larger or
    /// smaller depending on the machine (`ArgoTypeScale.drawnLineBox`).
    @Test
    func `the box is the title role's drawn line, not its nominal one`() {
        #expect(SessionMarker.titleLineBox == ArgoTypography.rowTitle.rung.drawnLineBox)
        #expect(SessionMarker.titleLineBox != ArgoTypography.rowTitle.nominalLineBox)
    }

    /// The chevron is wider than the column it sits in, and the column does not grow for it: every
    /// title on the roster, folds included, starts at one x.
    @Test
    func `the column is the state dot's width, whatever the mark inside it is`() {
        #expect(SessionMarker.columnWidth == ArgoIconSize.statusDot)
        #expect(ArgoIconSize.chevron.rawValue > SessionMarker.columnWidth)
    }
}
