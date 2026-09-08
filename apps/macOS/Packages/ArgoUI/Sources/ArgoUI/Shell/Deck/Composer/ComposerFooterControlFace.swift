import ArgoDesign
import SwiftUI

/// The common frame for the two menus on the composer footer.
struct ComposerFooterControlFace: ViewModifier {
    @Environment(\.argo) private var argo

    let isHovered: Bool

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, ArgoSpacing.base)
            .frame(height: ComposerFooterControl.height)
            .fixedSize(horizontal: true, vertical: false)
            .background {
                if isHovered {
                    RoundedRectangle(cornerRadius: ArgoRadius.control)
                        .fill(argo.color.surface.hover)
                }
            }
            .contentShape(.rect(cornerRadius: ArgoRadius.control))
    }
}

extension View {
    func composerFooterControl(isHovered: Bool) -> some View {
        modifier(ComposerFooterControlFace(isHovered: isHovered))
    }
}
