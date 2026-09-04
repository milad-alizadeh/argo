import ArgoEngine
import SwiftUI

/// Which wait the reading is showing, if any. Its IDENTITY rather than its age: an age is counted
/// from the moment this value CHANGES.
///
/// Every case is DIRECT — Argo started the thing and Argo is waiting on it. Nothing DERIVED may
/// reach it: a Session observed from outside can be `running` for reasons Argo did not cause, and a
/// plinth over that would claim an act nobody performed (`cockpit-feed-waiting.md`).
package enum FeedWait: Equatable {
    /// Argo started a CLI and it has not spoken yet — a wait on the PROCESS rather than on the
    /// agent, so it ends on the first bytes off the PTY rather than on a record (#587).
    case starting
    /// The Turn is thinking, and the thread stands over the whole measure.
    case thinking
    /// The Turn is running this row's call, and the ion crosses its own type.
    case call(FeedRow.ID)

    /// What the ROWS say this reading is waiting on. A row appended while the wait runs does not
    /// change it, so a think that says something and goes on thinking stays one wait.
    ///
    /// They are read back rather than decided a second time: `FeedProjection` owns the split
    /// between the thread and a lit row. `starting` is never among the answers, because it draws no
    /// row at all — it stands on the plinth alone, and reaches the surface through
    /// `EnvironmentValues.argoFeedWait` instead. `FeedColumn.waiting` is where the two meet.
    package static func showing(in rows: [FeedRow]) -> FeedWait? {
        if let lit = rows.first(where: { $0.kind.isCallInFlight }) {
            return .call(lit.id)
        }
        return rows.contains { $0.content == .mark(.working) } ? .thinking : nil
    }
}

package extension EnvironmentValues {
    /// The wait ARGO ITSELF is holding on the reading below, injected from above the deck.
    ///
    /// In the environment because it draws no row: a wait is not written into the reading while it
    /// runs (`cockpit-feed-waiting.md`), so the surface that stands it up cannot read it back off
    /// the rows the way the other waits are read. Threading it instead would put one optional
    /// through the four views between the shell and `FeedColumn`, which is what `deckIsResizing`
    /// and `argoOpenSession` are already in here to avoid.
    ///
    /// `nil` in a preview, a specimen and a suite, where nothing above sets one — and `nil` for
    /// every Session Argo did not start, which is what keeps this surface DIRECT.
    @Entry var argoFeedWait: FeedWait?
}
