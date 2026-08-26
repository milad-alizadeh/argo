import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

@Suite("Roster search")
struct RosterSearchTests {
    @Test
    func `a blank query is the absence of a filter, not a filter matching nothing`() {
        #expect(matching("").count == rows.count)
        // Spaces alone are a field somebody tabbed through, not a search for a space.
        #expect(matching("   ").count == rows.count)
    }

    @Test
    func `the title matches, and the case it was typed in does not`() {
        #expect(matching("RENAME").map(\.id) == ["renamed"])
        #expect(matching("rename").map(\.id) == ["renamed"])
    }

    @Test
    func `the branch and the worktree are searchable, not only the title`() {
        // Two facts the row DRAWS. A search that only read the title would miss the Session you
        // remember by where it is rather than by what it is called.
        #expect(matching("#504").map(\.id) == ["untouched"])
        #expect(matching("cockpit").map(\.id) == ["observed"])
    }

    @Test
    func `an age is not searchable, however plainly the row says it`() {
        // `4h ago` is the roster's own wording of a moment. Matching it would let a query mean
        // something no Session ever said about itself.
        #expect(matching("ago").isEmpty)
    }

    @Test
    func `two words narrow the list rather than widening it`() {
        // ANDed: a search gets tighter as you type. ORing would add rows on every keystroke,
        // which reads as the field being broken.
        #expect(matching("correct design").map(\.id) == ["untouched"])
        #expect(matching("correct rename").isEmpty)
    }

    @Test
    func `a query nothing matches keeps no rows, and does not fall back to all of them`() {
        #expect(matching("a Session nobody has").isEmpty)
    }

    /// Projected exactly as the shell projects it, so what is searched is what a reader can see.
    private let rows = SessionRosterProjection.rows(from: [
        CockpitPresentation.Session(
            id: "renamed",
            title: "Ship the native shell",
            access: .managed,
            status: .running,
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#515-rename-session"),
            ),
            annotations: .init(explicitName: "Tonight's rename run"),
        ),
        CockpitPresentation.Session(
            id: "untouched",
            title: "Correct the design docs",
            access: .managed,
            status: .idle,
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#504-correct-design-docs"),
            ),
        ),
        CockpitPresentation.Session(
            id: "observed",
            title: "Watch an external agent work",
            access: .external,
            status: .idle,
            chain: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(4 * 60)),
            work: .init(
                location: "/Users/milad/Developer/cockpit",
                workspace: .init(kind: .worktree, branch: "main"),
            ),
        ),
    ])

    private func matching(_ query: String) -> [SessionRosterProjection.Row] {
        RosterSearch.matching(query, in: rows)
    }
}
