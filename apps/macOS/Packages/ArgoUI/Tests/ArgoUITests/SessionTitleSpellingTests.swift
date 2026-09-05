import ArgoEngine
@testable import ArgoUI
import Testing

/// No title the cockpit draws carries an em dash (#1291). Asserted at the seam every surface
/// reads a name through, and on each of the three links of the chain in turn — the rule is about
/// the TITLE, so it cannot be held at any one of the places a title comes from.
@Suite("Session title spelling")
struct SessionTitleSpellingTests {
    @Test
    func `a derived title's em dash reads as a colon`() {
        let session = Self.session(title: "Roster row — the pulse on the running dot")

        #expect(SessionTitle.resolved(for: session) == "Roster row: the pulse on the running dot")
    }

    @Test
    func `a name somebody typed is spelled the same way`() {
        // The rule is about what is DRAWN, so a name arriving from the rename field answers to it
        // exactly as the two Argo composes do.
        let session = Self.session(title: "/implement 1291", explicitName: "Tonight's run — take 2")

        #expect(SessionTitle.resolved(for: session) == "Tonight's run: take 2")
    }

    @Test
    func `a Ticket's own words are spelled the same way`() {
        let session = Self.session(
            title: "/implement 1291",
            issue: .init(number: 1291, title: "The roster row — a pulse and a second line"),
        )

        // The provider's own em dash, and no number joined in front of it: the title is the
        // Ticket's sentence alone (#1347).
        #expect(
            SessionTitle.resolved(for: session)
                == "The roster row: a pulse and a second line",
        )
    }

    @Test
    func `the Reset target offers the words the row would then draw`() throws {
        let session = Self.session(
            title: "Roster row — the pulse", explicitName: "Tonight's run",
        )

        let naming = try #require(SessionTitle.namings(across: [session]).first)

        #expect(naming.resetsTo == "Roster row: the pulse")
    }

    @Test
    func `a title with no em dash is left exactly as it is`() {
        let session = Self.session(title: "Retire Electron, set new design foundations")

        #expect(
            SessionTitle.resolved(for: session) == "Retire Electron, set new design foundations",
        )
    }

    @Test(arguments: [
        ("A—B", "A: B"),
        ("Roster row —", "Roster row"),
        ("— the pulse", "the pulse"),
        ("A — B — C", "A: B: C"),
        // Nothing but dashes has no reading behind it to fall back to, so it keeps what it had:
        // a blank row says less than a strange one.
        ("—", "—"),
    ])
    func `the space before the dash goes with it`(written: String, drawn: String) {
        #expect(SessionTitle.resolved(for: Self.session(title: written)) == drawn)
    }

    private static func session(
        title: String,
        issue: CockpitPresentation.Session.Issue? = nil,
        explicitName: String? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: title,
            access: .managed,
            status: .idle,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#1291-roster-row-pulse"),
                ticket: issue.map { .linked($0) } ?? .unread,
            ),
            annotations: .init(explicitName: explicitName),
        )
    }
}
