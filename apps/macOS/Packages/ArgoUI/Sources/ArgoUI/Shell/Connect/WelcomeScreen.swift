import SwiftUI

/// What Argo does, in plain language, before anything is asked of the user.
///
/// Three benefit rows and no jargon: no feature grid, no honesty-tier ladder, nothing the reader
/// has to learn before they can press the button (#265). The tiers are real and they stay
/// internal; what a connection buys you is said as the thing you get.
struct WelcomeScreen: View {
    @Environment(\.argo) private var argo

    let start: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.section) {
            VStack(alignment: .leading, spacing: ArgoSpacing.base) {
                Text(WelcomeCopy.heading)
                    .argoText(ArgoTypography.identityHeading)
                    .foregroundStyle(argo.color.text.primary)
                Text(WelcomeCopy.subheading)
                    .argoText(ArgoTypography.body)
                    .foregroundStyle(argo.color.text.secondary)
            }
            // Not the Form the Connect half is: nothing here is settable, and a settings surface
            // whose rows do nothing when clicked is a promise the screen cannot keep.
            VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
                ForEach(WelcomeCopy.benefits) { benefit in
                    VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                        Text(benefit.title)
                            .argoText(ArgoTypography.rowTitle)
                            .foregroundStyle(argo.color.text.primary)
                        Text(benefit.detail)
                            .argoText(ArgoTypography.rowMeta)
                            .foregroundStyle(argo.color.text.secondary)
                    }
                }
            }
            HStack {
                Spacer(minLength: ArgoSpacing.flush)
                Button(WelcomeCopy.start, action: start)
                    .argoText(ArgoTypography.control)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(ArgoSpacing.region)
        .frame(width: ArgoConnectPanel.width, alignment: .leading)
    }
}

#Preview("Welcome") {
    WelcomeScreen(start: {})
        .argoAppearance()
}
