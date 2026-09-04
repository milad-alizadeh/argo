import ArgoDesign
import ArgoEngine
import ArgoFixtures
import ArgoUI
import Foundation
import SwiftUI

/// A roster mixing Sessions Argo owns with Sessions it only watches — the SHIPPING row, over the
/// sidebar list it ships inside.
///
/// Its own case because ghosting is a claim about a row's NEIGHBOURS: one dimmed row alone is just
/// a row. `sessionRows` carries one read-only Session among four; this one alternates, and puts
/// every element a row can draw on a ghosted one — a long title, a worktree, an age, and a state
/// word in the loudest ink the roster has, and the activity line a running Session draws (#1199).
struct GhostedRosterSpecimen: View {
    var body: some View {
        List {
            ForEach(Self.rows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }

    static let rows = SessionRosterProjection.rows(from: mixedAccess)

    /// The Project this roster is scoped to — the checkout whose rows draw no second line.
    private static let checkout = "/Users/milad/Developer/argo"

    /// Managed and observed alternating, so no run of one access reads as the roster's default.
    private static let mixedAccess = [
        CockpitPresentation.Session(
            id: "managed-running",
            title: "Ship the native Liquid Glass application shell",
            access: .managed,
            status: .running,
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(
                location: "\(checkout)/.claude/worktrees/ticket-508-row-ghosted",
                workspace: .init(kind: .worktree, branch: "argo/#508-external-row-ghosted"),
            ),
        ),
        CockpitPresentation.Session(
            id: "observed-asking",
            // Long, located, aged and waiting: everything a row can draw, all of it ghosted.
            title: "Answer a question from a Session nobody here started",
            access: .external,
            status: .asking,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(7))),
            work: .init(
                location: "\(checkout)/.claude/worktrees/ticket-502-session-header",
                workspace: .init(
                    kind: .worktree,
                    branch: "argo/#502-roster-row-and-session-header",
                ),
            ),
        ),
        CockpitPresentation.Session(
            id: "managed-idle",
            // In the Project's own checkout: a one-line row between two-line ones.
            title: "Wait for the next instruction",
            access: .managed,
            status: .idle,
            chain: .init(
                program: .init(model: "claude-sonnet-4"),
                span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(3 * 60)),
            ),
            work: .init(location: checkout, workspace: .init(kind: .main, branch: "main")),
        ),
        CockpitPresentation.Session(
            id: "observed-running",
            // Live and unreachable at once: the dot is the loudest thing on a running row and has
            // to dim with the rest. Detached, so there is no branch to name.
            title: "Watch an externally launched agent work",
            access: .external,
            status: .running,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(0))),
            work: .init(
                location: "/Users/milad/Experiments/argo/.claude/worktrees/ticket-311-spike",
                workspace: .init(kind: .worktree),
            ),
            // Running, so the row draws an activity line — the one thing on the second line that
            // pushes the clock to the far edge, and it has to ghost with the rest of the row.
            transcript: .init(
                events: TranscriptFixtures.previewTranscript + TranscriptFixtures.stillWorking,
            ),
        ),
        CockpitPresentation.Session(
            id: "observed-unknown",
            // No dot, no age, no git read behind it — the quietest row the roster can draw.
            title: "Read a transcript that says almost nothing",
            access: .external,
            status: .unknown,
            work: .init(location: "/Users/milad/Developer/cockpit"),
        ),
    ]
}

#Preview("Ghosted roster — driveable rows and rows that are not") {
    GhostedRosterSpecimen()
        .frame(height: 340)
        .argoAppearance()
}
