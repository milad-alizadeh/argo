import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The arrow in its circle — the composer's one act on the world — and Stop in the same circle
/// while a Turn is running (#541).
///
/// It carries no word: "Send" beside an arrow beside a Return hint is one instruction three
/// times, so the word lives in the accessibility label and the key in the tooltip. The accent
/// arrives with something to send and leaves with it.
///
/// One control and not two, and the position is the reason. What the pointer is over when a Turn
/// starts must be the thing that acts on that run — a second button appearing beside this one would
/// move the send under the hand of somebody reaching for it, at the one moment they are reaching
/// fast. Stop is therefore a STATE of this control: same box, same place, the attention ink in
/// place of the accent.
struct SendButton: View {
    @Environment(\.argo) private var argo

    let isSendable: Bool
    /// Whether a Turn is in flight — the whole of what makes this Stop rather than Send.
    var isRunning = false
    let send: () -> Void
    /// Stop that Turn. Inert by default so a preview draws the state without a port behind it.
    package var stop: () -> Void = {}

    var body: some View {
        ArgoIconButton(
            // The tooltip says MORE than the label rather than something else: the key that
            // presses this, and what a stop actually stops.
            voice: ArgoControlVoice(
                isRunning ? "Stop" : "Send",
                help: isRunning ? "Stop the running Turn" : "Send — Return",
            ),
            face: ArgoControlFace(ink: argo.color.text.onAccent, ground: .fill(ground)),
            act: isRunning ? stop : send,
            mark: { mark },
        )
        // Never disabled while a Turn runs: stopping one has nothing to do with whether there is
        // anything in the field, and the empty field is the commonest state to be stopping from.
        .disabled(!isRunning && !isSendable)
    }

    /// A symbol for one state and a drawn square for the other, which is not the inconsistency it
    /// looks like: the icon scale's floor is 10 and the study draws this mark at 7. The arrow is a
    /// stroke with air inside its box and the stop is a solid that fills one, so a shared rung is
    /// two different amounts of ink — see `ArgoComposerVessel.stopMark`.
    @ViewBuilder private var mark: some View {
        if isRunning {
            Rectangle()
                .frame(
                    width: ArgoComposerVessel.stopMark,
                    height: ArgoComposerVessel.stopMark,
                )
        } else {
            ArgoGlyph(ArgoSymbol.send, .control)
        }
    }

    private var ground: ArgoColor {
        if isRunning {
            argo.color.state.attention
        } else if isSendable {
            argo.color.interaction.accent
        } else {
            argo.color.surface.raised
        }
    }
}

#Preview("Send button — nothing to send, something to send, and a Turn to stop") {
    HStack(spacing: ArgoSpacing.loose) {
        SendButton(isSendable: false, send: {})
        SendButton(isSendable: true, send: {})
        SendButton(isSendable: false, isRunning: true, send: {})
    }
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}
