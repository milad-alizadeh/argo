import ArgoAtoms
import ArgoDesign
import SwiftUI

/// A follow-up held until the running Turn ends, riding above the field (design decision 4).
///
/// Above the field and never inside it, in the slot the standing-allow tray and the attachment
/// chips take: where the vessel says what is attached to the next turn.
///
/// It runs the vessel's full width and stands taller than a chip does, because what it holds is a
/// SENTENCE the user has to be able to check before it goes.
struct QueuedTurnChip: View {
    @Environment(\.argo) private var argo

    let turn: QueuedTurn
    /// Whether a release reached this follow-up and the port would not take it (#1238). Only the
    /// word and its ink move: the words are still here and Retry still sends them, so a chip that
    /// changed shape would read as something the reader had lost.
    var isRefused = false
    /// Take it back — the whole point of drawing a queued turn is that it is still recallable.
    let cancel: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Text(label)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(labelInk)
            Text(turn.text)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.primary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: cancel) {
                ArgoGlyph(ArgoSymbol.dismiss, .inline)
                    .argoHitTarget()
                    .foregroundStyle(argo.color.text.tertiary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel the queued follow-up")
            .help("Cancel the queued follow-up")
        }
        .padding(.horizontal, ArgoSpacing.snug)
        .frame(height: ArgoComposerVessel.queuedTurnHeight)
        .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.control))
        .clipShape(.rect(cornerRadius: ArgoRadius.control))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(turn.text)")
    }

    /// Which of the two words this chip is wearing. A `var` on the view rather than a ternary in
    /// the `body`, so the accessibility label below reads the same one the eye does.
    private var label: String {
        isRefused ? Self.refusedLabel : Self.label
    }

    /// The refused word takes the seam's own failure ink, so the chip and the sentence above it
    /// read as ONE fact rather than as two things that happened.
    private var labelInk: ArgoColor {
        isRefused ? argo.color.state.failure : argo.color.interaction.accent
    }

    /// Said once, on the row, in the machine face the rest of the vessel's meta is set in.
    static let label = "QUEUED"

    /// What the same word becomes when a release reached this follow-up and the port refused it
    /// (#1238). It states the OUTCOME and not the port's reason: the reason is one line above, on
    /// the seam, with the Retry that answers it.
    static let refusedLabel = "NOT SENT"
}

#Preview("Queued turn — one follow-up waiting") {
    QueuedTurnChip(
        turn: QueuedTurn(text: "And when that is green, open the PR against main."),
        cancel: {},
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Queued turn — one the port would not take") {
    QueuedTurnChip(
        turn: QueuedTurn(text: "And when that is green, open the PR against main."),
        isRefused: true,
        cancel: {},
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Queued turn — longer than the vessel") {
    QueuedTurnChip(
        turn: QueuedTurn(
            text: String(repeating: "And then check the anchor survives a compaction. ", count: 6),
        ),
        cancel: {},
    )
    .padding(ArgoSpacing.section)
    .frame(width: 480)
    .argoDeckSurface()
    .argoAppearance()
}
