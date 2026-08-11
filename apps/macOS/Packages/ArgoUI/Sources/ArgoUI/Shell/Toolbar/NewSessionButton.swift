import SwiftUI

/// The affordance for STARTING a Session: one icon at the leading edge of the bar, in a glass
/// container of its own, next to the system sidebar toggle.
///
/// The glass is spelled HERE and not left to the toolbar: this control must not merge with a
/// neighbour, so its item hides the shared background and carries its own.
struct NewSessionButton: View {
    /// How far the mark moves right and up to sit centred in its container. One number for both
    /// axes because the symbol's own imbalance is diagonal.
    ///
    /// Measured off a 2x render rather than chosen: uncorrected, the square sat 1.28pt left and
    /// 1.31pt below the container's centre; corrected, it is within 0.22pt and 0.31pt, which is
    /// less than one device pixel. Not worth tuning further — at 2x this lands on whole pixels
    /// either way, so a smaller number rounds to nothing and a larger one overshoots.
    private static let opticalCentring: CGFloat = 1.25

    @Environment(\.argo) private var argo

    let offer: NewSessionOffer
    let spawn: () async -> Void

    var body: some View {
        Button {
            Task { await spawn() }
        } label: {
            ArgoGlyph(ArgoSymbol.newSession, .control)
                .foregroundStyle(ink)
                // `square.and.pencil` draws its square in the LOWER-LEFT of its own glyph box and
                // spends the top-right on the pencil, so a box centred in the container leaves the
                // body of the mark 1.3pt down and left of centre. The correction centres the
                // SQUARE, and belongs to this symbol.
                .offset(x: Self.opticalCentring, y: -Self.opticalCentring)
                // A SQUARE of the bar's own container height, and not `toolbarSegment()`: that
                // modifier measures a segment INSIDE a vessel, so it sized this container to one
                // glyph plus padding — shorter than every other container on the bar, and with
                // the mark sitting off its centre.
                .frame(
                    width: ArgoLayout.toolbarVesselHeight,
                    height: ArgoLayout.toolbarVesselHeight,
                )
                .contentShape(.circle)
                .glassEffect(in: .circle)
        }
        .buttonStyle(.plain)
        .disabled(!offer.isLaunchable)
        .help(offer.blocked ?? "\(NewSessionOffer.label) — \(NewSessionOffer.shortcutDescription)")
        .accessibilityLabel(NewSessionOffer.label)
        .accessibilityHint(offer.blocked ?? NewSessionOffer.detail)
    }

    /// A disabled plain button dims nothing of a label it did not draw, so the state is spelled in
    /// the ink as well as in the sentence on it.
    private var ink: ArgoColor {
        offer.isLaunchable ? argo.color.text.primary : argo.color.text.tertiary
    }
}

#Preview("New Session button") {
    NewSessionButton(offer: NewSessionOffer(presentation: .preview), spawn: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("New Session button — nothing registered") {
    NewSessionButton(offer: NewSessionOffer(presentation: .unregisteredPreview), spawn: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
