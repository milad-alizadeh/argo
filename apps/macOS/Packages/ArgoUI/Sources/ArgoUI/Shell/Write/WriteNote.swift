import SwiftUI

/// The one line a write control says beside itself, the gesture onto what the operation printed
/// (§5), and the repair where §7 gives it one.
///
/// **Beside the control, never under it.** These bands are fixed-height rows, so a line below would
/// resize the row the control is in. A dot and a line in the chip's ink, because this is the same
/// failure the top bar reports.
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
            line
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

    @ViewBuilder private var line: some View {
        let text = Text(reason)
            .argoText(ArgoTypography.rowMeta)
            .lineLimit(1)
            .truncationMode(.tail)
        // A tooltip is not a raw channel (#850), so it survives only beside a line nothing stands
        // behind — where it hands over the whole text rather than standing in for the output.
        if output == nil {
            text.help(reason)
        } else {
            text
        }
    }

    private var ink: ArgoColor {
        ArgoOperationalState.failure.tint(in: argo.color)
    }
}

extension WriteNote {
    /// The note one write control's state asks for, and `nil` where it asks for none. Every part of
    /// it comes off the one state, so the line can never disagree with the output behind it.
    init?(control: WriteControlState, reconnect: @escaping () -> Void) {
        guard let reason = control.reason else { return nil }
        self.init(
            reason: reason,
            output: control.output,
            reconnect: control.needsReconnect ? reconnect : nil,
        )
    }
}

#Preview("Write notes — a provider's own words, and a token that died") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        WriteNote(
            control: .refused(.refused(WriteControlSpecimen.validationRefusal)), reconnect: {},
        )
        WriteNote(control: .refused(.unreachable(.rateLimited)), reconnect: {})
        WriteNote(control: .blocked(ConnectFixture.personal), reconnect: {})
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
