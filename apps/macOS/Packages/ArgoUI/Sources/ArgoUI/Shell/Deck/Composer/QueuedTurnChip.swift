import SwiftUI

/// A follow-up held until the running Turn ends, riding above the field (design decision 4).
///
/// Above the field and never inside it: the words have left the draft — they are going, and the
/// only question is when — so leaving them where they were typed would read as a message the user
/// still has to send. The slot is the one the standing-allow tray and the attachment chips take,
/// for the same reason: it is where the vessel says what is attached to the next turn.
///
/// It runs the vessel's full width rather than sitting in a flow with its neighbours, because what
/// it holds is a sentence: a follow-up truncated to fit beside two others is one the user cannot
/// check before it goes. It keeps the chip's HEIGHT all the same — the slot has one rhythm whether
/// it is holding attachments, standing allows or this.
struct QueuedTurnChip: View {
    @Environment(\.argo) private var argo

    let turn: QueuedTurn
    /// Take it back. The whole point of drawing a queued turn is that it is still recallable — a
    /// message you can see but not stop is worse than one sent immediately.
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
                    .foregroundStyle(argo.color.text.tertiary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel the queued follow-up")
            .help("Cancel the queued follow-up")
        }
        .padding(.horizontal, ArgoSpacing.snug)
        .frame(height: ArgoComposerVessel.chipHeight)
        .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.control))
        // The accent rule on the leading edge, not a tinted fill: the row has to read as WAITING
        // against a field that is live, and a wash across it at that contrast would read as the
        // selected thing instead.
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(argo.color.interaction.accent)
                .frame(width: ArgoStroke.indicator)
        }
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
