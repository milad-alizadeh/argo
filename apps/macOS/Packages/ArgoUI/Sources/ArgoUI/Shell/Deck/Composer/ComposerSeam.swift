import SwiftUI

/// The line above the vessel: why the last send did not go, and the way to try it again.
///
/// A failed send keeps the message where it was typed (design decision 8), so this line carries
/// only the reason and the retry — never the text, and never a toast that would leave with the
/// answer still unknown.
struct ComposerSeam: View {
    @Environment(\.argo) private var argo

    let detail: String
    let retry: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Text(detail)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.state.failure)
            Button("Retry", action: retry)
                .buttonStyle(.plain)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.interaction.accent)
        }
        .padding(.horizontal, ArgoSpacing.loose)
        .accessibilityElement(children: .combine)
    }
}

#Preview("Composer seam — a refused send") {
    ComposerSeam(detail: "Argo no longer holds this Session — nothing was sent", retry: {})
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
