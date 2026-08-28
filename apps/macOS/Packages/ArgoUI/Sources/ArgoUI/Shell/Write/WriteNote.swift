import SwiftUI

/// The one line a write control says beside itself — §4's *error inline at the control*, which is
/// where the one thing you need to know belongs after you have just pressed something.
///
/// **Beside the control, never under it.** The bands these controls sit in are fixed-height rows,
/// so a line below would resize the row the control is in — the layout shift §4 rules out. Beside
/// it, the note eats the free space the row already has.
///
/// A dot and a line, in the chip's shape and the chip's ink: this is the same failure the top bar
/// reports, and a triangle here would be a second failure mark for one fact. The line truncates and
/// the full text rides the tooltip, which is a stopgap until AC8 routes the unabridged output.
struct WriteNote: View {
    @Environment(\.argo) private var argo

    let reason: String

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Circle()
                .fill(ArgoOperationalState.failure.tint(in: argo.color))
                .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
                .accessibilityHidden(true)
            Text(reason)
                .argoText(ArgoTypography.rowMeta)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .foregroundStyle(ArgoOperationalState.failure.tint(in: argo.color))
        .help(reason)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(reason)
    }
}

#Preview("Write notes — a provider's own words, and a token that died") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        WriteNote(reason: "Issues are disabled for this repository.")
        WriteNote(reason: "Reconnect milad-alizadeh on GitHub")
        WriteNote(reason: "The write did not land — rate limited")
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
