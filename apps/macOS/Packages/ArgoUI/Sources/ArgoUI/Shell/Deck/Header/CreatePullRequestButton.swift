import ArgoDesign
import SwiftUI

/// The action behind the claim (#1335): one `/ship` Turn into the shown Session, through the
/// existing turn-delivery path (`CockpitView.createPullRequest`) — no new process, and the
/// Session reports its own status as it runs, so the row returns to the ordinary running state
/// without this control asserting anything about it.
///
/// Present only for a managed Session (`SessionHeaderProjection.Header.showsCreatePullRequest`),
/// and it draws no running word: unlike a handoff, typing one Turn is answered at once and there
/// is nothing here to hold. The label keeps the design's own frozen words.
package struct CreatePullRequestButton: View {
    @Environment(\.argo) private var argo

    let run: () -> Void

    /// The design's word for it (`cockpit-roster-row.md`, decision 6), verbatim.
    static let word = "Create PR"
    static let detail = "Runs /ship in this Session to open a pull request."

    package var body: some View {
        HeaderCapsuleButton(
            label: HeaderCapsuleButton.Label(
                word: Self.word,
                ink: argo.color.interaction.accent,
                detail: Self.detail,
            ),
            run: run,
        )
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(run: @escaping () -> Void) {
        self.run = run
    }
}
