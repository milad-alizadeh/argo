import SwiftUI

/// The arrow in its circle — the composer's one act on the world.
///
/// It carries no word: "Send" beside an arrow beside a Return hint is one instruction three
/// times, so the word lives in the accessibility label and the key in the tooltip. The accent
/// arrives with something to send and leaves with it, which is the only state the control has.
struct SendButton: View {
    @Environment(\.argo) private var argo

    let isSendable: Bool
    let send: () -> Void

    var body: some View {
        Button(action: send) {
            ArgoGlyph(ArgoSymbol.send, .control)
                .foregroundStyle(ink)
                .frame(
                    width: ArgoComposerVessel.controlDiameter,
                    height: ArgoComposerVessel.controlDiameter,
                )
                .background(ground, in: .circle)
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .disabled(!isSendable)
        .help("Send — Return")
        .accessibilityLabel("Send")
    }

    private var ground: ArgoColor {
        isSendable ? argo.color.interaction.accent : argo.color.surface.raised
    }

    private var ink: ArgoColor {
        isSendable ? argo.color.text.onAccent : argo.color.text.disabled
    }
}

#Preview("Send button — with and without something to send") {
    HStack(spacing: ArgoSpacing.loose) {
        SendButton(isSendable: false, send: {})
        SendButton(isSendable: true, send: {})
    }
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}
