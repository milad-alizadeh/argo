import SwiftUI

/// The line above the vessel: why the last send did not go, and the way to try it again.
///
/// A failed send keeps the message where it was typed (design decision 8), so this line carries
/// only the reason and the retry — never the text, and never a toast that would leave with the
/// answer still unknown. Retry is a real button on the trailing edge rather than a link trailing
/// the sentence: it is the remedy, and a remedy has to be a target.
struct ComposerSeam: View {
    @Environment(\.argo) private var argo

    let detail: String
    let retry: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(ArgoSymbol.refused, .control)
                .foregroundStyle(argo.color.state.failure)
            Text(detail)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.state.failure)
            Spacer()
            Button(action: retry) {
                Label("Retry", systemImage: ArgoSymbol.retry)
                    .argoText(ArgoTypography.caption)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
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
