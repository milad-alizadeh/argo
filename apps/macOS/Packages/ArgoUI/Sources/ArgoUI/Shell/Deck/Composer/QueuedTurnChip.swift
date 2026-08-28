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
    /// Take it back — the whole point of drawing a queued turn is that it is still recallable.
    let cancel: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Text(Self.label)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.interaction.accent)
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
        .accessibilityLabel("\(Self.label): \(turn.text)")
    }

    /// Said once, on the row, in the machine face the rest of the vessel's meta is set in.
    static let label = "QUEUED"
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
