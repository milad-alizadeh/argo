import SwiftUI

/// The graphite plane both composer menus stand on — `/` and `@` (#685, #687).
///
/// A MENU and not glass (D14, `cockpit-composer-picker.md`): it hangs off the field the reader is
/// typing in, and the vessel under it is already glass. No `.glassEffect`, no
/// `GlassEffectContainer`.
struct ComposerMenuSurface: ViewModifier {
    @Environment(\.argo) private var argo

    /// What a screen reader calls the surface. Each menu names itself.
    let label: String

    func body(content: Content) -> some View {
        content
            .padding(ArgoSpacing.tight)
            .background(.regularMaterial, in: shape)
            .overlay { rim }
            .argoShadow(.popover)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(label)
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.popover)
    }

    /// The only thing separating this surface from the glass vessel it stands over.
    private var rim: some View {
        shape.strokeBorder(argo.color.edge.glassRim, lineWidth: ArgoStroke.border)
    }
}

extension View {
    func argoComposerMenu(labelled label: String) -> some View {
        modifier(ComposerMenuSurface(label: label))
    }
}
