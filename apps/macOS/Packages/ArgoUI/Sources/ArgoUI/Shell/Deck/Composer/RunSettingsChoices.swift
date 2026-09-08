import ArgoDesign
import ArgoEngine
import SwiftUI

struct HarnessSegment: View {
    @Environment(\.argo) private var argo
    let harness: AgentCLI
    let isSelected: Bool
    let select: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: select) {
            HStack(spacing: ArgoSpacing.hair) {
                AgentMark(harness: harness)
                Text(harness.readableName).argoText(ArgoTypography.control)
            }
            .foregroundStyle(argo.color.text.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, ArgoSpacing.tight)
            .background {
                if isSelected || isHovered {
                    RoundedRectangle(cornerRadius: ArgoRadius.control)
                        .fill(isSelected ? argo.color.surface.selected : argo.color.surface.hover)
                }
            }
            .contentShape(.rect(cornerRadius: ArgoRadius.control))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .onHover { isHovered = $0 }
    }
}

/// One descriptive choice shared by Model and Permission lists, so both keep the same type,
/// spacing, hover ground and selection mark.
struct DescriptiveChoiceRow: View {
    @Environment(\.argo) private var argo
    let name: String
    let detail: String
    let isSelected: Bool
    let select: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: select) {
            HStack(alignment: .center, spacing: ArgoSpacing.base) {
                VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                    Text(name).argoText(ArgoTypography.body)
                    Text(detail)
                        .argoText(ArgoTypography.caption)
                        .foregroundStyle(argo.color.text.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: ArgoSpacing.base)
                if isSelected {
                    Image(systemName: "checkmark")
                        .argoIcon(.inline)
                        .foregroundStyle(argo.color.interaction.accentBright.color)
                        .accessibilityHidden(true)
                }
            }
            .foregroundStyle(argo.color.text.primary)
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.vertical, ArgoSpacing.snug)
            .background {
                if isHovered {
                    RoundedRectangle(cornerRadius: ArgoRadius.control)
                        .fill(argo.color.surface.hover)
                }
            }
            .contentShape(.rect(cornerRadius: ArgoRadius.control))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .onHover { isHovered = $0 }
    }
}
