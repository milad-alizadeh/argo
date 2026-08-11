import SwiftUI

/// A control that is prominent by placement and weight, never by hue.
///
/// The contract rations Ion Blue to selection and focus, and a stock tinted button spends it on
/// whatever happens to be nearby. A surface with four of them has no primary action at all — which
/// is the state this style exists to avoid: the system's own default button stays accent-coloured
/// and stays the only one on the screen, and everything beside it takes this.
struct QuietButtonStyle: ButtonStyle {
    @Environment(\.argo) private var argo

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .argoText(ArgoTypography.control)
            .foregroundStyle(argo.color.text.primary)
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.vertical, ArgoSpacing.tight)
            .background {
                RoundedRectangle(cornerRadius: ArgoRadius.control)
                    .fill(
                        configuration.isPressed
                            ? argo.color.surface.selected
                            : argo.color.surface.overlay,
                    )
            }
            .contentShape(.rect)
    }
}

extension ButtonStyle where Self == QuietButtonStyle {
    static var quiet: QuietButtonStyle {
        QuietButtonStyle()
    }
}

#Preview("Quiet control, at rest") {
    HStack(spacing: ArgoSpacing.base) {
        Button("Locate…") {}
        Button("Change folder…") {}
    }
    .buttonStyle(.quiet)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
