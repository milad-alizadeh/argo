import SwiftUI

/// What Argo does, in plain language, before anything is asked of the user.
///
/// Three benefit rows and no jargon: no feature grid, no honesty-tier ladder, nothing the reader
/// has to learn before they can press the button (#265). The tiers are real and they stay
/// internal; what a connection buys you is said as the thing you get.
struct WelcomeScreen: View {
    @Environment(\.argo) private var argo

    /// One promise, said once. A value rather than three copies of a `VStack`, because the three
    /// differ in their words and in nothing else.
    private struct Benefit: Identifiable {
        let id: String
        let detail: String
    }

    private static let benefits = [
        Benefit(
            id: "Every session in one window",
            detail: "See what each agent is doing, and step in when one needs you.",
        ),
        Benefit(
            id: "Read the work, not just the result",
            detail: "Follow what an agent changed, ran and asked, as it happens.",
        ),
        Benefit(
            id: "Your issues and pull requests beside it",
            detail: "Connect an account and the backlog, reviews and checks come with it.",
        ),
    ]

    let start: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.section) {
            VStack(alignment: .leading, spacing: ArgoSpacing.base) {
                Text("Argo watches the agents you run.")
                    .argoText(ArgoTypography.identityHeading)
                    .foregroundStyle(argo.color.text.primary)
                Text("Point it at a folder and it starts there. Everything else is optional.")
                    .argoText(ArgoTypography.body)
                    .foregroundStyle(argo.color.text.secondary)
            }
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                ForEach(Self.benefits) { benefit in
                    ConnectRow(
                        row: ConnectPanelProjection.row(
                            title: benefit.id,
                            detail: benefit.detail,
                        ),
                        isDetailMachine: false,
                    ) { EmptyView() }
                }
            }
            HStack {
                Spacer(minLength: ArgoSpacing.flush)
                Button("Get started", action: start)
                    .argoText(ArgoTypography.control)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(ArgoSpacing.region)
        .frame(width: ArgoLayout.connectPanelWidth, alignment: .leading)
    }
}

#Preview("Welcome") {
    WelcomeScreen(start: {})
        .argoAppearance()
}
