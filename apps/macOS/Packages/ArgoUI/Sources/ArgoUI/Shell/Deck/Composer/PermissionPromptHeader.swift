import SwiftUI

/// The prompt's first line: what this vessel is. No clock — the prompt holds until it is answered,
/// and a countdown on a surface nobody watches only asks to be beaten.
struct PermissionPromptHeader: View {
    @Environment(\.argo) private var argo

    var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            ArgoGlyph(ArgoSymbol.permission, .inline)
            ArgoStateLabel(word: "Permission")
            Spacer()
        }
        .foregroundStyle(argo.color.state.attention)
    }
}
