import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

@Suite("Session header projection")
struct SessionHeaderProjectionTests {
    @Test
    func `the header names its Session, in the Session's own words`() {
        let header = SessionHeaderProjection.header(from: session(title: "Ship the native shell"))

        #expect(header.title == "Ship the native shell")
    }

    @Test
    func `a managed Session carries no access mark at all`() {
        let header = SessionHeaderProjection.header(from: session(access: .managed))

        // Not a mark reading "managed", and not an empty one: no mark at all.
        #expect(header.access == nil)
        // The title, then the Session's own facts — and nothing where a posture would have gone.
        #expect(header.announcement.hasPrefix("Session, Claude Code"))
        #expect(header.announcement.hasSuffix("On main"))
    }

    @Test
    func `an external Session is marked read-only`() throws {
        let header = SessionHeaderProjection.header(from: session(access: .external))

        let mark = try #require(header.access)
        #expect(mark.word == "Read-only")
        #expect(mark.detail.contains("never owned"))
    }

    @Test
    func `an orphaned Session is named as one, never as an external Session`() throws {
        let header = SessionHeaderProjection.header(from: session(access: .orphaned))

        // "Argo lost the terminal" is a different fact from "this was never yours", and both are
        // read-only — so the two postures cannot share a word.
        let mark = try #require(header.access)
        #expect(mark.word == "Orphaned")
        #expect(mark.word != SessionHeaderProjection
            .header(from: session(access: .external)).access?.word)
        #expect(mark.detail.contains("terminal died"))
    }

    @Test
    func `every access posture decides its own mark`() {
        // `allCases`, so a posture added to the axis has to answer here.
        let words = CockpitPresentation.Session.Access.allCases.map {
            SessionHeaderProjection.header(from: session(access: $0)).access?.word
        }

        #expect(words == [nil, "Read-only", "Orphaned"])
    }

    @Test
    func `only the posture that lost something is worth a colour`() throws {
        let marks = CockpitPresentation.Session.Access.allCases.map {
            SessionHeaderProjection.header(from: session(access: $0)).access
        }

        // Asserted on the MARKS, not on a list of tones: managed has no mark and external has a
        // mark with no tint, and mapping straight to `tone` collapses both absences into `nil`.
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

        // The same word the roster row spends, in the amber the dot beside it is set in.
        let state = try #require(header.state)
        #expect(state.word == "Needs input")
        #expect(state.tone == .attention)
    }

    @Test
    func `the header spends the roster's word or none, never a second wording`() {
        // Every status answered against the one place the word is decided, so a header cannot
        // grow a mapping of its own.
        let words = SessionStatus.allCases.map {
            SessionHeaderProjection.header(from: session(status: $0)).state?.word
        }

        #expect(words == SessionStatus.allCases.map { SessionState.word(for: $0) })
        #expect(words == [nil, nil, "Needs input", "Needs input", nil, "Stopped", nil, nil])
    }

    @Test
    func `a Session at rest leaves the band's word unspent`() {
        let header = SessionHeaderProjection.header(from: session(status: .idle))

        #expect(header.state == nil)
        #expect(header.title == "Session")
        #expect(header.checkout?.branch == "main")
    }

    @Test
    func `the word is announced once, beside the identity rather than inside it`() {
        // The band draws it as its own element, so a screen reader already reaches it; folding it
        // into the identity as well would read the state out twice.
        let header = SessionHeaderProjection.header(from: session(status: .permission))

        #expect(!header.announcement.contains("Needs input"))
    }

    @Test
    func `the header the preview draws the word on is a Session really waiting on one`() throws {
        // A fixture carrying the word without the status would be a picture of something the
        // projection cannot produce.
        let state = try #require(SessionHeaderFixture.needsInput.state)

        #expect(state.word == "Needs input")
        #expect(SessionHeaderFixture.headers.allSatisfy { $0.state == nil })
    }

    @Test
    func `the cwd is not on the header`() {
        // The location is on the value the header is projected FROM, so nothing but this stops it
        // drifting back onto the line.
        let header = SessionHeaderProjection.header(from: session(
            title: "Ship the native shell",
            access: .managed,
        ))

        #expect(!header.announcement.contains("/Users/milad/Developer/argo"))
    }

    @Test
    func `the headers the specimens render reach every access posture`() {
        let drawn = SessionHeaderFixture.headers

        #expect(drawn.map { $0.access?.word } == [nil, "Read-only", "Orphaned"])
        // A marked posture on a branch long enough to eat the fact line: the mark sits at the END
        // of the line, so what crowds it out is the branch and not the title.
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
            access: access,
            status: status,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
            work: .init(location: "/Users/milad/Developer/argo", workspace: .init(branch: "main")),
        )
    }
}
