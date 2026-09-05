import ArgoDesign
import SwiftUI

/// The action behind the claim (#1335): one `/ship` Turn into the shown Session, through the
/// existing turn-delivery path (`CockpitView+Intents.createPullRequest`) — no new process, and
/// the Session reports its own status as it runs, so the row returns to the ordinary running
/// state without this button asserting anything about it. Present only for a managed Session
/// (`SessionHeaderProjection.Header.showsCreatePR`); there is no disabled or blocked state to
/// draw, unlike `SessionHandoffButton`, because typing `/ship` never waits on anything this
/// control can observe.
package struct CreatePRButton: View {
    @Environment(\.argo) private var argo

    let run: () -> Void

    package var body: some View {
        Button(action: run) {
            Text("Create PR")
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.interaction.accent)
                .lineLimit(1)
                .padding(.horizontal, ArgoSpacing.snug)
                .padding(.vertical, ArgoSpacing.hair)
                .background(argo.color.surface.overlay, in: .capsule)
                .overlay {
                    Capsule().strokeBorder(
                        argo.color.interaction.accent,
                        lineWidth: ArgoStroke.border,
                    )
                }
        }
        .buttonStyle(.plain)
        .help("Runs /ship in this Session to open a pull request.")
        .layoutPriority(1)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(run: @escaping () -> Void) {
        self.run = run
    }
}
