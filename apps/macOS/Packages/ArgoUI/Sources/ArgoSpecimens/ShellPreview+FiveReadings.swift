import ArgoEngine
import ArgoFixtures
import ArgoUI

public extension CockpitPresentation {
    /// Five Sessions, each with a reading of its own — what a reader actually browses, and one more
    /// than the decks are capped at, so a walk through them evicts.
    ///
    /// Each transcript is numbered from a different turn, so no two of them share a row: a case
    /// switching between these can say WHICH reading is drawn rather than only that one is
    /// (`TranscriptFixtures.longTranscript(from:)`).
    static let fiveReadings = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "argo",
        sessions: (0 ..< 5).map { at in
            Session(
                id: "reading-\(at)",
                title: "Reading \(at + 1) of five, long enough to scroll",
                access: .managed,
                status: at.isMultiple(of: 2) ? .running : .idle,
                chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
                work: .init(
                    location: "/Users/milad/Developer/argo",
                    workspace: .init(kind: .worktree, branch: "argo/#\(1113 + at)-reading"),
                ),
                spend: .init(context: .held(100_000 + at * 20000)),
                transcript: .init(events: TranscriptFixtures.longTranscript(from: at * 1000)),
            )
        },
        connection: .connected,
    )
}
