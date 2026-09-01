import SwiftUI

/// The one line a write control says beside itself, and the repair where §7 gives it one.
///
/// **Beside the control, never under it.** These bands are fixed-height rows, so a line below would
/// resize the row the control is in. A dot and a line in the chip's ink, because this is the same
/// failure the top bar reports.
///
/// The line truncates, and what the operation printed is one gesture away in the nearest raw
/// channel §5's table admits (#850). In the Tickets room's toolbar that is neither a session's Dock
/// nor the Code room's scratch terminal, so it is the table's third row: inline at the invoking
/// affordance, error text verbatim.
struct WriteNote: View {
    @Environment(\.argo) private var argo

    let reason: String
    /// What the operation printed, and `nil` where the line IS the whole of it — a sentence Argo
    /// worded itself has no output to open.
    var output: RawOutput?
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
                // Only where nothing stands behind the line: a tooltip is not a raw channel, and
                // one beside the gesture would offer the same text by a route nobody can copy from.
                .help(output == nil ? reason : "")
            if let output {
                RawOutputDisclosure(output: output)
            }
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
    let refusal = WriteControlState.refused(.refused(WriteControlSpecimen.validationRefusal))

    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        WriteNote(reason: refusal.reason ?? "", output: refusal.output)
        WriteNote(reason: "The write did not land — rate limited")
        WriteNote(reason: "GitHub · milad-alizadeh · needs reconnect", reconnect: {})
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
