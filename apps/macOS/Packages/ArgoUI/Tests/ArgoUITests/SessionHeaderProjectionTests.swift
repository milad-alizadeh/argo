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
        #expect(header.access == nil)
        #expect(header.announcement == "Session")
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
    func `what the header announces is the mark it draws, never a second claim`() {
        // A screen reader hears no ink, so the word the mark spends has to be said out loud —
        // and it has to be the SAME word, decided once here.
        let header = SessionHeaderProjection.header(from: session(
            title: "Watch an externally launched agent",
            access: .external,
        ))

        #expect(header.announcement == "Watch an externally launched agent, Read-only")
    }

    @Test
    func `the header names the branch the roster no longer has room for`() {
        let header = SessionHeaderProjection.header(from: session(branch: "argo/#537-rail"))

        // Verbatim, and not shortened to its ticket: the header is where a ref is spelled out
        // well enough to be typed back into a terminal.
        #expect(header.branch == "argo/#537-rail")
        #expect(header.announcement.contains("on argo/#537-rail"))
    }

    @Test
    func `a Session on no branch says nothing where the branch would go`() {
        // A detached checkout, or a Session that never branched at all. Absent rather than the
        // `HEAD` its record carries: an unestablishable fact is not rendered as the nearest word.
        let header = SessionHeaderProjection.header(from: session(branch: nil))

        #expect(header.branch == nil)
        #expect(header.announcement == "Session")
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
        // A marked posture whose title is long enough to be cut at the narrowest deck, because
        // whether the mark survives that cut is the render question no value test can settle —
        // and a short title on every marked fixture would leave it unrendered.
        #expect(drawn.contains { $0.access != nil && $0.title.count > 100 })
        // Both branch renderings, because the header is where the branch went: a fixture set
        // that always carried one would leave the detached rendering unlooked-at.
        #expect(drawn.contains { $0.branch != nil })
        #expect(drawn.contains { $0.branch == nil })
    }

    private func session(
        title: String = "Session",
        access: CockpitPresentation.Session.Access = .managed,
        branch: String? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: title,
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            branch: branch,
            access: access,
            status: .idle,
        )
    }
}
