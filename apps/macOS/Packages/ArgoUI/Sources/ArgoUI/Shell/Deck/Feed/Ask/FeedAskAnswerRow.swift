import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The field a question is answered in, and the `Answer` that closes the act.
///
/// The field and the button both STATE the height rather than being floored at it: the prototype
/// proved a `min-height` is not a height — floored and stretched, the two still settled a couple of
/// points apart, and the row has to have one top and one bottom.
struct FeedAskAnswerRow: View {
    @Environment(\.argo) private var argo

    @Binding var text: String
    let placeholder: String
    /// Whether there is anything to send — a pick, or words in the field.
    let canSend: Bool
    let send: () -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            field
            button
        }
    }

    /// No ground of its own, exactly as `ComposerField` draws none — the card underneath is the
    /// ground, and a second one inside it reads as a well.
    private var field: some View {
        TextField(
            placeholder,
            text: $text,
            prompt: Text(placeholder).foregroundStyle(argo.color.text.disabled.color),
        )
        .textFieldStyle(.plain)
        .argoText(ArgoFeedRow.proseRung)
        .foregroundStyle(argo.color.text.primary)
        .focused($isFocused)
        .onSubmit(submit)
        .padding(.horizontal, ArgoSpacing.comfortable)
        .frame(height: ArgoComposerVessel.decisionHeight)
        .overlay { shape.strokeBorder(fieldEdge, lineWidth: ArgoStroke.border) }
        .argoAnimation(.selection, value: isFocused)
        .accessibilityLabel(placeholder)
    }

    /// The Permission prompt's Allow, at its own measurements. `⏎` sends, because there is
    /// something to send — unlike `esc`, which an ask leaves unbound: an ask has no refusal.
    private var button: some View {
        Button(action: submit) {
            HStack(spacing: ArgoSpacing.tight) {
                Text("Answer")
                DeckKeycap(key: "⏎")
            }
            .argoText(ArgoTypography.control)
            .foregroundStyle(canSend ? argo.color.text.onAccent : argo.color.text.disabled)
            .padding(.horizontal, ArgoSpacing.comfortable)
            .frame(
                minWidth: ArgoComposerVessel.decisionMinimumWidth,
                maxHeight: ArgoComposerVessel.decisionHeight,
            )
            .frame(height: ArgoComposerVessel.decisionHeight)
            .background(buttonGround, in: shape)
        }
        .buttonStyle(.plain)
        .disabled(!canSend)
        .accessibilityLabel("Answer")
    }

    private func submit() {
        guard canSend else { return }
        send()
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
    }

    private var fieldEdge: ArgoColor {
        isFocused ? argo.color.interaction.accent : argo.color.edge.hairline
    }

    private var buttonGround: ArgoColor {
        canSend ? argo.color.interaction.accent : argo.color.surface.marked
    }
}
