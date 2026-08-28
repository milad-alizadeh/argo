import SwiftUI

extension View {
    /// Widens what a small mark answers clicks over, WITHOUT moving the mark: the square is laid
    /// OVER it rather than around it, so nothing in the row's rhythm shifts.
    func argoHitTarget() -> some View {
        overlay {
            Color.clear
                .frame(width: ArgoLayout.controlHitTarget, height: ArgoLayout.controlHitTarget)
                .contentShape(.rect)
        }
    }
}

#Preview("Hit target — the square a chevron answers over") {
    // The ground is drawn only so the target is VISIBLE here; nothing that ships paints it.
    HStack(spacing: ArgoSpacing.region) {
        ArgoDisclosure(.beside)
            .argoHitTarget()
            .background(ArgoPalette.graphite.surface.selected.color)
        ArgoGlyph(ArgoSymbol.dismiss, .inline)
            .argoHitTarget()
            .background(ArgoPalette.graphite.surface.selected.color)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
