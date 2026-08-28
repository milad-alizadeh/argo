import SwiftUI

extension View {
    /// Widens what a small mark answers clicks over, WITHOUT moving the mark.
    ///
    /// A glyph at an inline rung is twelve points across, and a chevron is narrower still — a
    /// target a pointer has to be aimed at rather than moved to. The square here is invisible and
    /// laid OVER the mark rather than around it, so nothing in the row's rhythm shifts and the
    /// press lands where the reader was already pointing. The same trick `DeckSeam` plays over a
    /// hairline, and for the same reason.
    func argoHitTarget(_ size: CGFloat = ArgoLayout.controlHitTarget) -> some View {
        overlay {
            Color.clear
                .frame(width: size, height: size)
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
