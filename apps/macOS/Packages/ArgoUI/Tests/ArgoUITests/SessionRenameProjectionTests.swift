import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The name a Session is shown by, and the dialog that sets it. Both projections are asserted here
/// because the claim is that they AGREE on `explicit → issue → derived` (#502, story 19).
@Suite("Session rename projection")
struct SessionRenameProjectionTests {
    @Test
    func `an explicit name beats the derived title on the roster and on the header`() throws {
        let renamed = session(explicitName: "The overnight run")

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)
        let header = SessionHeaderProjection.header(from: renamed)

        #expect(row.title == "The overnight run")
        #expect(header.title == "The overnight run")
    }

    @Test
    func `an explicit name beats the linked issue's title too`() throws {
        let renamed = session(
            issue: .init(number: 515, title: "Rename a Session"),
            explicitName: "Tonight's rename",
        )

        // Both fallbacks at once, and the issue link itself is untouched by a rename.
        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)
        #expect(row.title == "Tonight's rename")
        #expect(SessionHeaderProjection.header(from: renamed).issue?.label == "Issue #515")
    }

    @Test
    func `with no explicit name the issue's title is what shows`() throws {
        let linked = session(issue: .init(number: 515, title: "Rename a Session"))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        // The ticket's own sentence, and no number joined in front of it (#1347).
        #expect(row.title == "Rename a Session")
    }

    @Test
    func `a Session nobody renamed shows the title its transcript derived`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [session()]).first)

        #expect(row.title == "Ship the native shell")
        #expect(SessionHeaderProjection.header(from: session()).title == "Ship the native shell")
    }

    @Test
    func `the dialog opens on the name the row is showing`() throws {
        let renamed = session(explicitName: "The overnight run")

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        // Opening on the DERIVED title would silently discard the name it was opened from.
        #expect(row.rename?.name == row.title)
        #expect(row.rename?.sessionID == row.id)
    }

    @Test
    func `the Reset offers the title the rename covered up`() throws {
        let renamed = session(explicitName: "A typo nobody can read")

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        // Shown as words: after a typo the original is nowhere else on screen (#502, story 20).
        #expect(row.rename?.derived == "Ship the native shell")
    }

    @Test
    func `the Reset goes back to the issue's title where a provider gave one`() throws {
        let renamed = session(
            issue: .init(number: 515, title: "Rename a Session"),
            explicitName: "Tonight's rename",
        )

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        // Undoing the rename lands where the Session would have been without it, not one rung
        // further down the chain.
        #expect(row.rename?.derived == "Rename a Session")
    }

    @Test
    func `a Session nobody renamed is offered no Reset`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [session()]).first)

        // Through `#require`, so the claim is that the rename EXISTS and offers no Reset — an
        // optional compared to `nil` would pass just as well on a row carrying no rename at all.
        #expect(try #require(row.rename).derived == nil)
    }

    @Test
    func `a Session renamed to exactly its derived title is still renamed`() throws {
        let renamed = session(explicitName: "Ship the native shell")

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        // The record says the user renamed it, so the Reset that clears that record is still
        // offered — read off the stored name and never off a comparison of the two.
        #expect(row.rename?.derived == "Ship the native shell")
    }

    @Test
    func `an archived Session is renamable behind the foot too`() throws {
        let renamed = session(explicitName: "Cleared, and named", isArchived: true)

        let row = try #require(SessionRosterProjection.archivedRows(from: [renamed]).first)

        // The foot draws the same row, and the same field opens in it.
        #expect(row.title == "Cleared, and named")
        #expect(row.rename?.derived == "Ship the native shell")
    }

    @Test
    func `the roster the rename specimens render puts a chosen name beside derived ones`() {
        // The `renamedRoster` and `editingRow` PNGs are the only evidence these renderings have, so
        // the fixture has to carry both a renamed row and a derived one.
        let rows = RenameFixture.rows

        #expect(rows.contains { $0.rename?.derived != nil })
        #expect(rows.contains { $0.rename.map { $0.derived == nil } == true })
    }

    @Test
    func `the editing specimen opens its field on a row that is actually on the roster`() throws {
        // A specimen naming a Session the roster does not carry renders a list with no field in it,
        // which looks like the roster at rest rather than like a broken case.
        let editing = try #require(RenameFixture.rows.first { $0.id == RenameFixture.editingRowID })

        // The first rename of a Session, which is the state the field is met in: nothing to reset.
        #expect(try #require(editing.rename).derived == nil)
    }

    private func session(
        issue: CockpitPresentation.Session.Issue? = nil,
        explicitName: String? = nil,
        isArchived: Bool = false,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "Ship the native shell",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "main"),
                ticket: issue.map { .linked($0) } ?? .unread,
            ),
            annotations: .init(isArchived: isArchived, explicitName: explicitName),
        )
    }
}
