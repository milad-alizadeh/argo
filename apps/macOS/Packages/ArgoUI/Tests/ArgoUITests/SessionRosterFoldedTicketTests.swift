import ArgoEngine
@testable import ArgoUI
import Testing

/// What a run under a FOLD is called once several Sessions are on one Ticket (#1251).
///
/// `SessionRosterRivalTicketTests` owns the same question for the rows the roster draws itself,
/// and the two claims meet here: a fold's runs are drawn beside each other and nowhere near the
/// roster's own rows, so they contest each other and take nothing off a row above them.
@Suite("Sessions sharing one ticket under a fold")
struct SessionRosterFoldedTicketTests {
    @Test
    func `a run folded away is no rival to the row the reader can see`() {
        // The two loops fold into one row, so neither draws the Ticket's words — and a row that
        // draws none may not take them off the row that does.
        #expect(SessionRosterProjection.rows(from: Self.aFoldBesideOneRow()).map(\.title)
            == ["Rough atlas for Argo itself", "2 runs"])
    }

    @Test
    func `opening the fold leaves the row its title`() {
        let sessions = Self.aFoldBesideOneRow()
        let opened = SessionRosterProjection.foldIDs(from: sessions)

        // A title that moved as the reader opened a fold would put the deck header, which reads
        // no fold, out of step with the row again.
        #expect(SessionRosterProjection.rows(from: sessions, opened: opened).map(\.title)
            == [
                "Rough atlas for Argo itself",
                "2 runs",
                "Write a caption",
                "These two files change together",
            ])
    }

    @Test
    func `two runs under one open fold do not both draw the ticket's words`() {
        let sessions = [
            Self.loop(id: "first", title: "Write a caption"),
            Self.loop(id: "second", title: "These two files change together"),
        ]
        let opened = SessionRosterProjection.foldIDs(from: sessions)

        // Nothing above them is on #650, but they are drawn beside EACH OTHER, so the rule #1072
        // wrote holds inside the fold too: two rows may not read one Ticket's words.
        #expect(SessionRosterProjection.rows(from: sessions, opened: opened).map(\.title)
            == ["2 runs", "Write a caption", "These two files change together"])
    }

    @Test
    func `a run its own ticket names apart keeps the words`() {
        let sessions = [
            Self.loop(
                id: "alone",
                title: "/implement 741",
                issue: SessionRosterRivalTicketTests.anchor,
            ),
            Self.loop(id: "other", title: "Write a caption"),
        ]
        let opened = SessionRosterProjection.foldIDs(from: sessions)

        // #745, unchanged inside a fold: each run its Ticket names apart still spends it.
        #expect(SessionRosterProjection.rows(from: sessions, opened: opened).map(\.title)
            == ["2 runs", "Anchor the feed", "Rough atlas for Argo itself"])
    }

    /// One row the reader can see, and beside it two headless loops in one folder — which fold
    /// into a single row, so the Ticket all three are on is drawn by exactly one of them.
    static func aFoldBesideOneRow() -> [CockpitPresentation.Session] {
        [
            SessionRosterRivalTicketTests.session(id: "own", title: "Name the widest module"),
            loop(id: "first", title: "Write a caption"),
            loop(id: "second", title: "These two files change together"),
        ]
    }

    /// A run that folds: headless, driven by nobody, and in a folder it shares with its sibling.
    static func loop(
        id: String,
        title: String,
        issue: CockpitPresentation.Session.Issue = SessionRosterRivalTicketTests.atlas,
    )
        -> CockpitPresentation.Session {
        RosterSessionFixture.session(
            id: id,
            title: title,
            workspaceLocation: "/Users/milad/Developer/argo/.claude/worktrees/loops",
            kind: .worktree,
            access: .external,
            entry: .headless,
            ticket: .linked(issue),
        )
    }
}
