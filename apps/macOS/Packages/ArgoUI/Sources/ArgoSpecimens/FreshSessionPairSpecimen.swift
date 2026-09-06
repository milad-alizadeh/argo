import ArgoEngine
import ArgoFixtures
import ArgoUI
import SwiftUI

/// Two Sessions started back to back in one window (#1479), at the moment they differ most: the
/// second has written its first record and carries a title of its own, the first is still waiting
/// on its PTY and carries none.
///
/// The state a single row cannot show. Two fresh Sessions read as one row for as long as the
/// second was folded into the first's chain, and one row is a shape every settled roster already
/// renders — so what needs looking at is a pair.
struct FreshSessionPairSpecimen: View {
    /// `AgentSpawn.title`'s own words, so a rename there shows up here.
    static let provisionalTitle = "New session"

    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: Self.presentation, actions: .inert)
            .environment(navigation)
    }

    /// Newest first, which puts the second Session at the head and its panel in frame.
    private static let presentation = CockpitPresentation(
        projects: CockpitPresentation.preview.projects,
        activeProjectID: CockpitPresentation.preview.activeProjectID,
        sessions: [spoken, starting],
        connection: .connected,
    )

    /// The second spawn, past its first record: its own id, its own title, its own feed.
    private static let spoken = CockpitPresentation.Session(
        id: "session-from-cli-2",
        title: "Read the second ticket",
        access: .managed,
        // Idle rather than running: what this render is about is the pair of rows, and an open
        // Turn would put a clock on one of them that has nothing to do with the claim.
        status: .idle,
        chain: .init(
            program: .init(cli: .claude, model: "claude-opus-5"),
            span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(0)),
        ),
        work: .init(
            location: CockpitPresentation.preview.activeProject?.location,
            workspace: .init(kind: .main, branch: "main"),
        ),
        transcript: .init(events: TranscriptFixtures.previewTranscript),
    )

    /// The first spawn, still under its claim's id and still `starting` — Argo holds the PTY and
    /// has heard nothing off it (#587).
    private static let starting = CockpitPresentation.Session(
        id: "claim-1",
        title: provisionalTitle,
        access: .managed,
        status: .starting,
        chain: .init(
            program: .init(cli: .claude),
            // Started BEFORE the one above it, and still silent — which is the whole reason the
            // roster draws it second.
            span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(1)),
        ),
        work: .init(location: CockpitPresentation.preview.activeProject?.location),
    )
}
