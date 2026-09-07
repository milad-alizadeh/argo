import ArgoEngine
@testable import ArgoUI
import Testing

/// Which name each row hands the mirror, and which rows hand it nothing (#1623).
///
/// The mirror types whatever this says, so this is where the two surfaces are made to agree: a
/// name decided here over a different set of rows than the roster draws is a name the phone shows
/// and the desk does not.
@Suite("Session names to mirror")
@MainActor
struct SessionNamesToMirrorTests {
    @Test
    func `each row hands over the name it draws, and how it came by it`() {
        let draws = Self.presentation(sessions: [
            Self.session(id: "derived", title: "Fix the roster titles"),
            Self.session(id: "renamed", title: "Fix the roster titles", explicitName: "Tonight's"),
        ]).namesToMirror

        #expect(draws["derived"]?.name == "Fix the roster titles")
        #expect(draws["derived"]?.drawsDerivedTitle == true)
        #expect(draws["renamed"]?.name == "Tonight's")
        #expect(draws["renamed"]?.drawsDerivedTitle == false)
    }

    /// The roster contests a Ticket's words in GROUPS — the archive apart from the roster, each
    /// fold apart from its list (#1251). A flat pass over every row at once sees two claimants for
    /// #741 and refuses the words to both, so the visible row would be mirrored under its derived
    /// summary while the roster drew the Ticket's sentence. Same Session, two names, which is the
    /// disagreement this ticket exists to end.
    @Test
    func `a Ticket contested only by an archived row is still the name mirrored`() {
        let visible = Self.session(id: "visible", title: "Fix the roster titles", issue: Self.issue)
        let archived = Self.session(
            id: "archived", title: "Read the ticket", issue: Self.issue, isArchived: true,
        )

        let draws = Self.presentation(sessions: [visible, archived]).namesToMirror

        // Exactly what the roster row draws — asserted against that projection rather than
        // restated, so the two cannot drift.
        #expect(draws["visible"]?.name
            == SessionRosterProjection.namedTitle(for: "visible", among: [visible, archived]))
        #expect(draws["visible"]?.name == "Anchor the feed")
        #expect(draws["visible"]?.drawsDerivedTitle == false)
    }

    /// `SessionStatus.starting` takes a typed line by every reading Argo has — Argo started the
    /// process and has not heard it yet — but the CLI has not drawn its prompt, so the line is
    /// swallowed by the TUI's boot while the driver reports it sent. Filed as landed, it would
    /// never be retried, which is exactly the rows Argo spawned itself.
    @Test
    func `a spawn Argo has not heard from yet hands over nothing`() {
        let draws = Self.presentation(sessions: [
            Self.session(id: "booting", title: "Fix the roster titles", status: .starting),
            Self.session(id: "idle", title: "Read the ticket"),
        ]).namesToMirror

        #expect(draws["booting"] == nil)
        #expect(draws["idle"] != nil)
    }

    @Test
    func `a row that can run no slash command right now is still handed over`() {
        let draws = Self.presentation(sessions: [
            Self.session(id: "blocked", title: "Fix the roster titles", status: .permission),
        ]).namesToMirror

        // Handed over and marked refused: the mirror does not gate on this.
        #expect(draws["blocked"]?.takesSlashCommand == false)
    }

    /// Answering a Permission frees the keyboard the `/rename` was refused by, so it is the one
    /// transition a blocked rename becomes possible on — and the map has to MOVE across it or the
    /// sweep that retries the rename never runs (#1662).
    @Test
    func `answering a permission moves the map, so the refused rename is retried`() {
        let blocked = Self.presentation(sessions: [
            Self.session(id: "chain-a", title: "Fix the roster titles", status: .permission),
        ]).namesToMirror
        let answered = Self.presentation(sessions: [
            Self.session(id: "chain-a", title: "Fix the roster titles", status: .running),
        ]).namesToMirror

        #expect(blocked != answered)
        // Same words on both sides, so the inequality can only be the readiness moving.
        #expect(blocked["chain-a"]?.name == answered["chain-a"]?.name)
        #expect(answered["chain-a"]?.takesSlashCommand == true)
    }

    private static let issue = CockpitPresentation.Session.Issue(
        number: 741, title: "Anchor the feed",
    )

    private static func presentation(
        sessions: [CockpitPresentation.Session],
    )
        -> CockpitPresentation {
        SessionRosterNamingMemo.forget()
        return CockpitPresentation(
            projects: [], activeProjectID: nil, sessions: sessions, connection: .idle,
        )
    }

    private static func session(
        id: String,
        title: String,
        issue: CockpitPresentation.Session.Issue? = nil,
        explicitName: String? = nil,
        isArchived: Bool = false,
        status: SessionStatus = .idle,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: title,
            access: .managed,
            status: status,
            work: .init(ticket: issue.map { .linked($0) } ?? .unread),
            annotations: .init(isArchived: isArchived, explicitName: explicitName),
        )
    }
}
