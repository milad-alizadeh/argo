import SwiftUI

/// The affordance for STARTING a Session: a bare icon button at the leading edge of the bar, next
/// to the system sidebar toggle and at the same weight as it.
///
/// Deliberately not a third glass vessel. The two approved ones each hold a compound reading — this
/// Project on this checkout, and the rooms — where this holds a verb; and the platform puts that
/// verb (Notes, Mail, Finder) beside the toggle for the sidebar the new thing lands in, which here
/// is the Sessions roster.
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
