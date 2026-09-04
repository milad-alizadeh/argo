import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import CoreGraphics
import Testing

/// The three-line roster row (#1343, `cockpit-roster-row.md`): which line each fact is on, and
/// where the leading column's mark sits against the title it answers to.
@Suite("The roster row's three lines")
struct SessionRowLinesTests {
    /// The rule the second line reads off. It is the whole fact slot and not the activity alone:
    /// a fold's folder label and an idle Session's `/implement` are the same slot, and the line
    /// goes only when the slot is empty.
    @Test
    func `a Session with something to say draws its second line`() throws {
        let row = try #require(rows(status: .running, events: [ran("bun run quality")]).first)

        #expect(row.secondaryFact == "Ran bun run quality")
        #expect(row.drawsActivityLine)
        // Line 3 is there either way — the clock left line 2 and never comes back to it.
        #expect(row.clock != nil)
    }

    @Test
    func `a Session with nothing to say draws no second line, and keeps its clock`() throws {
        // A title that already carries both the command and the number, so `toldApart` says
        // nothing either: the slot is empty rather than merely activity-less.
        let row = try #require(SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(
                id: "one", title: "/implement 1343", status: .idle, lastSeenAtMs: 0,
            ),
        ]).first)

        #expect(row.secondaryFact == nil)
        #expect(!row.drawsActivityLine)
        // The two-line row is a title and a clock, never a title and a gap.
        #expect(row.clock != nil)
    }

    /// The leading column carries a fold's disclosure where it carries a Session's dot, so the
    /// centring below has to answer for both marks.
    @Test
    func `a fold draws its second line from the folder it stands for`() throws {
        let fold = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            RosterSessionFixture.session(
                id: "headless-\(index)",
                workspaceLocation: RosterSessionFixture.checkout,
                access: .external,
                entry: .headless,
                status: .running,
                lastSeenAtMs: 0,
            )
        }).first { $0.fold != nil })

        #expect(fold.drawsActivityLine)
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

/// Where the leading column puts its mark. Every case reads the offset off the type role rather
/// than off a number, which is the point: a marker aligned by a magic number drifts the moment the
/// scale moves, and no case here can be satisfied by pinning the drift.
@MainActor
@Suite("The roster marker's centring")
struct SessionMarkerTests {
    @Test(arguments: [ArgoIconSize.statusDot, ArgoIconSize.chevron.rawValue])
    func `a mark's centre lands on the title's centre`(mark: CGFloat) {
        let centre = SessionMarker.inset(for: mark) + mark / 2

        #expect(abs(centre - SessionMarker.titleLineBox / 2) < 0.001)
    }

    /// The derivation itself, so a later edit cannot keep the centring while quietly swapping the
    /// box it is centred in for a constant.
    @Test
    func `the offset is derived from the title's own line box`() {
        #expect(SessionMarker.titleLineBox == ArgoTypography.rowTitle.rung.drawnLineBox)
        #expect(
            SessionMarker.inset(for: ArgoIconSize.statusDot)
                == (SessionMarker.titleLineBox - ArgoIconSize.statusDot) / 2,
        )
    }

    /// The chevron is wider than the column it sits in, and the column does not grow for it: every
    /// title on the roster, folds included, starts at one x.
    @Test
    func `the column is the state dot's width, whatever the mark inside it is`() {
        #expect(SessionMarker.columnWidth == ArgoIconSize.statusDot)
        #expect(ArgoIconSize.chevron.rawValue > SessionMarker.columnWidth)
    }
}
