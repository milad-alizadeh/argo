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
                ink: Self.ink(in: argo.color),
                detail: Self.detail,
            ),
            run: run,
        )
    }

    /// `availableControl`, never `interaction.accent` (#1575). The control is present from the
    /// moment a managed Session opens and reports only that there is a terminal to type `/ship`
    /// into — nothing about the branch, the commits or the companion's claim. The contract holds
    /// the reasoning and the rung; this states which of the two inks on the tab line the control
    /// takes, because that is the fact #1575 was opened for.
    static func ink(in palette: ArgoPalette) -> ArgoColor {
        palette.availableControl
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(run: @escaping () -> Void) {
        self.run = run
    }
}
