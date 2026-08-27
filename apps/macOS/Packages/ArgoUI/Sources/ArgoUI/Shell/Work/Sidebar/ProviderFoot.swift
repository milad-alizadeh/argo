import SwiftUI

/// The bound provider at the sidebar's foot, above a hairline (`cockpit-work-room.md`). Here and
/// not in the toolbar: it is a property of the provider whose views these are, and the toolbar's
/// trailing edge went to search.
struct ProviderFoot: View {
    @Environment(\.argo) private var argo

    let provider: WorkProvider

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            Divider()
                .hidden()
                .overlay(argo.color.edge.hairline)
            HStack(spacing: ArgoSpacing.snug) {
                SessionStateIndicator(state: provider.state)
                Text("\(provider.name) · \(provider.account)")
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: ArgoSpacing.flush)
            }
            .padding(.horizontal, ArgoWorkSidebar.footPaddingX)
            .padding(.vertical, ArgoWorkSidebar.footPaddingY)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Bound to \(provider.name) as \(provider.account)")
    }
}

#Preview("Provider foot") {
    ProviderFoot(provider: WorkProvider(name: "GitHub", account: "milad-alizadeh", state: .idle))
        .frame(width: ArgoLayout.sidebarMinimumWidth)
        .argoAppearance()
}

#Preview("Provider foot — a Binding Argo cannot establish") {
    ProviderFoot(provider: WorkProvider(name: "GitHub", account: "milad-alizadeh", state: nil))
        .frame(width: ArgoLayout.sidebarMinimumWidth)
        .argoAppearance()
}
