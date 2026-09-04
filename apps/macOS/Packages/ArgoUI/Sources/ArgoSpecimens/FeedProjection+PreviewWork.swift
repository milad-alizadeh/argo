import ArgoFixtures
import ArgoUI

// A Turn at a real one's call density — see `previewDenseTurnRows`. Its own file because
// `FeedProjection+Preview.swift` is at its length ceiling.

extension FeedProjection {
    /// A Turn at a real one's call density, projected — the render the per-Turn fold is judged
    /// from (#1172): two cards standing among the narration they fold across, and a second Turn
    /// below whose single calls keep their own rows.
    static let previewDenseTurnRows = rows(from: TranscriptFixtures.denseTurn)

    /// The card of commands in that reading — the only one with a failure counted in its header.
    static let previewFailedWorkRowID = previewDenseTurnRows.first { row in
        guard case let .work(work) = row.content else { return false }
        return work.failures > 0
    }?.id
}
