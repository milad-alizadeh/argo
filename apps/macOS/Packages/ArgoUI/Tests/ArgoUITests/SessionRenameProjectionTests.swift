import ArgoEngine
@testable import ArgoUI
import Testing

/// The name a Session is shown by, and the dialog that sets it. Both projections are asserted
/// here, in one suite, because the claim is that they AGREE: `explicit → issue → derived` drawn
/// two different ways is the bug the shared chain exists to make impossible (#502, story 19).
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

        // Both fallbacks at once: the name the user set is the last word, not the second
        // opinion. The issue link itself is untouched — renaming a Session says nothing about
        // what it is working on.
        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)
        #expect(row.title == "Tonight's rename")
        #expect(SessionHeaderProjection.header(from: renamed).issue?.label == "Issue #515")
    }

    @Test
    func `with no explicit name the issue's title is what shows`() throws {
        let linked = session(issue: .init(number: 515, title: "Rename a Session"))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

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

        // Renaming is usually editing. A dialog opening on an empty field would make every
        // correction a retype, and one opening on the DERIVED title would silently discard the
        // name it was opened from.
        #expect(row.rename.name == row.title)
        #expect(row.rename.sessionID == row.id)
    }

    @Test
    func `the Reset offers the title the rename covered up`() throws {
        let renamed = session(explicitName: "A typo nobody can read")

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        // Shown as words, because after a typo the original is nowhere else on screen — which is
        // the whole reason the control exists (#502, story 20).
        #expect(row.rename.derived == "Ship the native shell")
    }

    @Test
    func `the Reset goes back to the issue's title where a provider gave one`() throws {
        let renamed = session(
            issue: .init(number: 515, title: "Rename a Session"),
            explicitName: "Tonight's rename",
        )

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        // Resetting undoes the rename, and undoing it lands wherever the Session would have been
        // without it — not one rung further down the chain.
        #expect(row.rename.derived == "Rename a Session")
    }

    @Test
    func `a Session nobody renamed is offered no Reset`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [session()]).first)

        // Where there is nothing to undo there is no control to undo it with — and a Reset drawn
        // on every dialog would read as a way to clear the field.
        #expect(row.rename.derived == nil)
    }

    @Test
    func `a Session renamed to exactly its derived title is still renamed`() throws {
        let renamed = session(explicitName: "Ship the native shell")

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        // The record says the user renamed it, so the Reset that clears that record is still
        // offered — read off the stored name and never off a comparison of the two.
        #expect(row.rename.derived == "Ship the native shell")
    }

    @Test
    func `an archived Session is renamable behind the foot too`() throws {
        let renamed = session(explicitName: "Cleared, and named", isArchived: true)

        let row = try #require(SessionRosterProjection.archivedRows(from: [renamed]).first)

        // A Session put out of sight is not a Session described differently — the foot draws the
        // same row, and the same field opens in it.
        #expect(row.title == "Cleared, and named")
        #expect(row.rename.derived == "Ship the native shell")
    }

    @Test
    func `the roster the rename specimens render puts a chosen name beside derived ones`() {
        // The `renamedRoster` and `editingRow` PNGs are the only evidence these renderings have.
        // A fixture where every row was renamed would draw a roster nothing could be compared
        // against, and one where none were would draw the feature switched off.
        let rows = RenameFixture.rows

        #expect(rows.contains { $0.rename.derived != nil })
        #expect(rows.contains { $0.rename.derived == nil })
    }

    @Test
    func `the editing specimen opens its field on a row that is actually on the roster`() throws {
        // A specimen naming a Session the roster does not carry would render a list with no field
        // in it at all — which looks like the roster at rest rather than like a broken case.
        let editing = try #require(RenameFixture.rows.first { $0.id == RenameFixture.editingRowID })

        // The first rename of a Session, which is the state the field is met in: nothing to reset.
        #expect(editing.rename.derived == nil)
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
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .idle,
            cli: .claude,
            workspace: .init(branch: "main"),
            issue: issue,
            isArchived: isArchived,
            explicitName: explicitName,
        )
    }
}
