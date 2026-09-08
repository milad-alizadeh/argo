import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The adapter-authored permission picker on the composer's leading side.
struct ModePicker: View {
    @Environment(\.argo) private var argo

    let profile: SessionPermissionProfile?
    var setPermission: (String) -> Void = { _ in }
    var isOpenForRender = false

    @State private var isOpen = false
    @State private var isHovered = false

    var body: some View {
        Button { isOpen.toggle() } label: {
            HStack(spacing: ArgoSpacing.snug) {
                Image(systemName: "hand.raised").argoIcon(.control)
                Text(selected?.name ?? "Permission").argoText(ArgoTypography.control)
                Image(systemName: "chevron.up.chevron.down").argoIcon(.chevron)
            }
            .foregroundStyle(argo.color.text.primary)
            .composerFooterControl(isHovered: isHovered)
        }
        .buttonStyle(.plain)
        .disabled(profile == nil)
        .onHover { isHovered = $0 }
        .help(help)
        .accessibilityLabel(help)
        .popover(isPresented: $isOpen, arrowEdge: .bottom) {
            permissionMenu
                .presentationBackground(.regularMaterial)
        }
        .onAppear { isOpen = isOpenForRender }
    }

    private var permissionMenu: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text("Permission")
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
                .padding(.horizontal, ArgoSpacing.base)
            ForEach(profile?.choices ?? []) { choice in
                DescriptiveChoiceRow(
                    name: choice.name,
                    detail: choice.detail,
                    isSelected: choice.id == profile?.selectedID,
                ) {
                    setPermission(choice.id)
                    isOpen = false
                }
            }
        }
        .padding(ArgoSpacing.base)
        .frame(width: PermissionMenuMeasure.width)
        .argoAppearance()
    }

    private var selected: SessionPermissionProfile.Choice? {
        profile?.choices.first { $0.id == profile?.selectedID }
    }

    private var help: String {
        guard let selected else { return "Permission is unavailable" }
        return "Permission — \(selected.detail)"
    }
}

private enum PermissionMenuMeasure {
    static let width: CGFloat = 330
}
