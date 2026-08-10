import ArgoEngine
import Foundation
import SwiftUI

/// A roster mixing Sessions Argo owns with Sessions it only watches — the SHIPPING row, over the
/// sidebar list it ships inside.
///
/// Its own case because ghosting is a claim about a row's neighbours: one dimmed row alone is just
/// a row, and whether "you cannot drive this" reads without a glyph to hunt for is only answerable
/// with driveable rows above and below it. `sessionRows` carries one read-only Session among four;
/// this one alternates, and puts every element a row can draw on a ghosted one — a long title, a
/// branch, an age, and a state word in the loudest ink the roster has.
///
/// The last of those is the judgement the PNG exists for: an attention word is the one ink on the
/// row that is meant to be loud, and a ghosted row has to take it down with everything else rather
/// than leaving a bright badge on a Session nobody can answer.
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

    /// Managed and observed alternating, so no run of one access reads as the roster's default.
    private static let mixedAccess = [
        CockpitPresentation.Session(
            id: "managed-running",
            title: "Ship the native Liquid Glass application shell",
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            branch: "argo/#508-external-row-ghosted",
            access: .managed,
            status: .running,
        ),
        CockpitPresentation.Session(
            id: "observed-asking",
            // Long, branched, aged and waiting: everything a row can draw, all of it ghosted.
            title: "Answer a question from a Session nobody here started",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/cockpit",
            branch: "argo/#502-roster-row-and-session-header",
            access: .external,
            status: .asking,
            lastSeenAtMs: CockpitPresentation.minutesAgo(7),
        ),
        CockpitPresentation.Session(
            id: "managed-idle",
            title: "Wait for the next instruction",
            model: "claude-sonnet-4",
            workspaceLocation: "/Users/milad/Developer/cockpit",
            branch: "main",
            access: .managed,
            status: .idle,
            lastSeenAtMs: CockpitPresentation.minutesAgo(3 * 60),
        ),
        CockpitPresentation.Session(
            id: "observed-running",
            // Live and unreachable at once: the dot is the loudest thing on a running row, and
            // it has to dim with the rest rather than reading as a Session you could steer.
            title: "Watch an externally launched agent work",
            model: nil,
            workspaceLocation: "/Users/milad/Experiments/argo",
            branch: "main",
            access: .external,
            status: .running,
        ),
        CockpitPresentation.Session(
            id: "observed-unknown",
            // A transcript that stamped nothing and carried no turn boundary: no dot, no age,
            // no branch. The quietest row the roster can draw, ghosted on top of that.
            title: "Read a transcript that says almost nothing",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/cockpit",
            branch: nil,
            access: .external,
            status: .unknown,
        ),
    ]
}

#Preview("Ghosted roster — driveable rows and rows that are not") {
    GhostedRosterSpecimen()
        .frame(height: 340)
        .argoAppearance()
}
