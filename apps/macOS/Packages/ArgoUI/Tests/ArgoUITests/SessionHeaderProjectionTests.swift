import ArgoEngine
@testable import ArgoUI
import Testing

@Suite("Session header projection")
struct SessionHeaderProjectionTests {
    @Test
    func `the header names its Session, in the Session's own words`() {
        let header = SessionHeaderProjection.header(from: session(title: "Ship the native shell"))

        // Verbatim: a title is what the Session called itself, and a header that shortened,
        // capitalised or completed it would be the cockpit renaming somebody's work.
        #expect(header.title == "Ship the native shell")
    }

    @Test
    func `a managed Session carries no access mark at all`() {
        let header = SessionHeaderProjection.header(from: session(access: .managed))

        // The default state is silent. A mark on every header is a mark nobody reads by the
        // second Session, and the exceptions below are the only two worth the ink.
        // Not a mark reading "managed", and not an empty one: no mark at all.
        #expect(header.access == nil)
        // The title, then the Session's own facts — and nothing after them where a posture would
        // have gone, whatever word it might have spent.
        #expect(header.announcement.hasPrefix("Session, Claude Code · Opus 5"))
        #expect(header.announcement.hasSuffix("On main"))
    }

    @Test
    func `an external Session is marked read-only`() throws {
        let header = SessionHeaderProjection.header(from: session(access: .external))

        // The word is short enough to sit beside a title; what it MEANS is the sentence, and
        // the sentence lives here rather than in whatever surface happens to draw a tooltip.
        let mark = try #require(header.access)
        #expect(mark.word == "Read-only")
        #expect(mark.detail.contains("never owned"))
    }

    @Test
    func `an orphaned Session is named as one, never as an external Session`() throws {
        let header = SessionHeaderProjection.header(from: session(access: .orphaned))

        // "This was yours and Argo lost the terminal" is a different fact from "this was never
        // yours" — both are read-only, and a header spelling them the same way would say the
        // Session had never been Argo's.
        let mark = try #require(header.access)
        #expect(mark.word == "Orphaned")
        #expect(mark.word != SessionHeaderProjection
            .header(from: session(access: .external)).access?.word)
        #expect(mark.detail.contains("terminal died"))
    }

    @Test
    func `every access posture decides its own mark`() {
        // `allCases`, so a posture added to the axis has to answer here rather than inheriting
        // whichever branch the mapping happens to end on.
        let words = CockpitPresentation.Session.Access.allCases.map {
            SessionHeaderProjection.header(from: session(access: $0)).access?.word
        }

        #expect(words == [nil, "Read-only", "Orphaned"])
    }

    @Test
    func `only the posture that lost something is worth a colour`() throws {
        // Both are read-only, and colouring both would spend the loudest ink on the line for the
        // ordinary case — which is how the reader learns to scan past the one that matters. The
        // Session Argo LOST is the one somebody had reason to expect otherwise about.
        let marks = CockpitPresentation.Session.Access.allCases.map {
            SessionHeaderProjection.header(from: session(access: $0)).access
        }

        // Asserted on the MARKS, not on a list of tones: a managed Session has no mark at all and
        // an external one has a mark with no tint, and mapping straight to `tone` would collapse
        // those two different absences into the same `nil`.
        #expect(marks[0] == nil)
        #expect(try #require(marks[1]).tone == nil)
        #expect(try #require(marks[2]).tone == .attention)
    }

    @Test
    func `what the header announces is the mark it draws, never a second claim`() {
        // A screen reader hears no ink, so the word the mark spends has to be said out loud —
        // and it has to be the SAME word, decided once here.
        let header = SessionHeaderProjection.header(from: session(
            title: "Watch an externally launched agent",
            access: .external,
        ))

        #expect(header.announcement.hasPrefix("Watch an externally launched agent, Claude Code"))
        #expect(header.announcement.hasSuffix("Read-only"))
    }

    @Test
    func `a Session blocked on a Permission says so on its header`() throws {
        let header = SessionHeaderProjection.header(from: session(status: .permission))

        // The same word the roster row spends, in the amber the dot beside it is set in: a
        // Session waiting on somebody is visible on the band it was opened onto, not only on
        // the row that got you there.
        let state = try #require(header.state)
        #expect(state.word == "Needs input")
        #expect(state.tone == .attention)
    }

    @Test
    func `the header spends the roster's word or none, never a second wording`() {
        // Every status answered here, against the one place the word is decided — so a header
        // that grew a mapping of its own reds rather than quietly disagreeing with the row.
        let words = SessionStatus.allCases.map {
            SessionHeaderProjection.header(from: session(status: $0)).state?.word
        }

        #expect(words == SessionStatus.allCases.map { SessionState.word(for: $0) })
        #expect(words == [nil, "Needs input", "Needs input", nil, "Stopped", nil, nil])
    }

    @Test
    func `a Session at rest leaves the band's word unspent`() {
        // The calm states say nothing at all rather than naming themselves: a word on every
        // header is a word nobody reads by the second Session, which is what would cost
        // `Needs input` the one thing it is for.
        let header = SessionHeaderProjection.header(from: session(status: .idle))

        #expect(header.state == nil)
        // And the rest of the header is untouched by the absence — it is a quiet band, not a
        // shorter one.
        #expect(header.title == "Session")
        #expect(header.checkout?.branch == "main")
    }

    @Test
    func `the word is announced once, beside the identity rather than inside it`() {
        // The band draws it as its own element, so a screen reader already reaches it. Folding
        // it into the identity as well would read the Session's state out twice — the rule the
        // context instrument is kept out of `announcement` for.
        let header = SessionHeaderProjection.header(from: session(status: .permission))

        #expect(!header.announcement.contains("Needs input"))
    }

    @Test
    func `the header the preview draws the word on is a Session really waiting on one`() throws {
        // The word's rendering has no evidence but a look at it, and a fixture that carried the
        // word without the status would be a picture of something the projection cannot produce.
        let state = try #require(SessionHeaderFixture.needsInput.state)

        #expect(state.word == "Needs input")
        #expect(SessionHeaderFixture.headers.allSatisfy { $0.state == nil })
    }

    @Test
    func `the cwd is not on the header`() {
        // The line carries what identifies the Session, not where it happens to sit. Asserted
        // rather than assumed: the location is on the value the header is projected FROM, so
        // nothing but this stops it drifting back onto the line.
        let header = SessionHeaderProjection.header(from: session(
            title: "Ship the native shell",
            access: .managed,
        ))

        #expect(!header.announcement.contains("/Users/milad/Developer/argo"))
    }

    @Test
    func `the headers the specimens render reach every access posture`() {
        // The header PNGs are the only evidence these renderings have, and one posture missing
        // from the catalog is a state that ships without anybody looking at it.
        let drawn = SessionHeaderFixture.headers

        #expect(drawn.map { $0.access?.word } == [nil, "Read-only", "Orphaned"])
        // A marked posture on a branch long enough to eat the fact line, because whether the mark
        // survives that cut is the render question no value test can settle — the mark sits at
        // the END of the line now, so what crowds it out is the branch and not the title.
        #expect(drawn.contains {
            $0.access != nil && $0.checkout?.branch == SessionHeaderFixture.longBranchName
        })
    }

    private func session(
        title: String = "Session",
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: title,
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: access,
            status: status,
            cli: .claude,
            workspace: .init(branch: "main"),
        )
    }
}
