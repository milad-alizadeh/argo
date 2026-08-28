import SwiftUI

/// The one line a write control says beside itself, and the repair where §7 gives it one.
///
/// **Beside the control, never under it.** These bands are fixed-height rows, so a line below would
/// resize the row the control is in. A dot and a line in the chip's ink, because this is the same
/// failure the top bar reports.
///
/// The line truncates and the full text rides the tooltip, which is a stopgap until #850 routes the
/// unabridged output.
struct WriteNote: View {
    @Environment(\.argo) private var argo

    let reason: String
    /// The `Reconnect` §7 points at, and `nil` for a refusal that re-granting cannot repair.
    var reconnect: (() -> Void)?

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Circle()
                .fill(ink)
                .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
                .accessibilityHidden(true)
            Text(reason)
                .argoText(ArgoTypography.rowMeta)
                .lineLimit(1)
                .truncationMode(.tail)
                .help(reason)
            if let reconnect {
                Button("Reconnect", action: reconnect)
                    .buttonStyle(.plain)
                    .argoText(ArgoTypography.control)
            }
        }
        .foregroundStyle(ink)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(reason)
    }

    private var ink: ArgoColor {
        ArgoOperationalState.failure.tint(in: argo.color)
    }
}

#Preview("Write notes — a provider's own words, and a token that died") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        WriteNote(reason: "Issues are disabled for this repository.")
        WriteNote(reason: "The write did not land — rate limited")
        WriteNote(reason: "GitHub · milad-alizadeh · needs reconnect", reconnect: {})
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
