import SwiftUI

/// The affordance for STARTING a Session: one icon at the leading edge of the bar, in a glass
/// container of its own, next to the system sidebar toggle.
///
/// The glass is spelled HERE and not left to the toolbar, which is the opposite of what the two
/// vessels do — and for their own reason. A vessel takes the toolbar's glass so its halves MERGE
/// into one capsule; this control must not merge with anything, so its item hides the shared
/// background and carries its own. Between them: one capsule per reading, and a verb is its own
/// reading, not a fourth fact inside "this Project, on this checkout".
struct NewSessionButton: View {
    @Environment(\.argo) private var argo

    let offer: NewSessionOffer
    let spawn: () async -> Void

    var body: some View {
        Button {
            Task { await spawn() }
        } label: {
            ArgoGlyph(ArgoSymbol.newSession, .control)
                .foregroundStyle(ink)
                .toolbarSegment()
                // The height of the vessel beside it, not the height of one glyph. A container
                // that sizes to its content is a smaller container than every other one on the
                // bar, and two container heights on one bar is the thing a reader sees first.
                .frame(height: ArgoLayout.toolbarVesselHeight)
                // A capsule, like every other container here. One mark inside it at that height
                // makes it near enough a circle, which is what the platform draws for a lone verb.
                .glassEffect(in: .capsule)
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
