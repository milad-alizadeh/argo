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
///
/// Two controls on the trailing edge, and they are the two things a reader can decide about words
/// that have not gone yet: send them NOW, or take them back (#1238). Both are the chip's own,
/// because both are about this follow-up rather than about the Session.
struct QueuedTurnChip: View {
    @Environment(\.argo) private var argo

    let turn: QueuedTurn
    /// Where this follow-up has got to — the word it wears, and which controls it offers.
    var standing = QueuedTurnStanding.queued
    /// Put it into the running Turn now, ahead of the boundary it is waiting for.
    var steer: () -> Void = {}
    /// Take it back — the whole point of drawing a queued turn is that it is still recallable.
    let cancel: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Text(standing.label)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(labelInk)
            Text(turn.text)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.primary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            controls
        }
        .padding(.horizontal, ArgoSpacing.snug)
        .frame(height: ArgoComposerVessel.queuedTurnHeight)
        .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.control))
        .clipShape(.rect(cornerRadius: ArgoRadius.control))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(standing.label): \(turn.text)")
    }

    /// Both gone while a steer is in flight: the interrupt has landed, so there is no longer a Turn
    /// to keep these words back from, and neither act means anything until the paste has gone.
    @ViewBuilder private var controls: some View {
        if standing.isCancellable {
            Button(action: steer) {
                ArgoGlyph(ArgoSymbol.steer, .inline)
                    .argoHitTarget()
                    .foregroundStyle(argo.color.text.tertiary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Self.steerLabel)
            .help(Self.steerLabel)
            Button(action: cancel) {
                ArgoGlyph(ArgoSymbol.dismiss, .inline)
                    .argoHitTarget()
                    .foregroundStyle(argo.color.text.tertiary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Self.cancelLabel)
            .help(Self.cancelLabel)
        }
    }

    /// The word's ink, resolved from the role the standing names — the contract's colours come off
    /// the environment, which only a view has.
    private var labelInk: ArgoColor {
        switch standing.ink {
        case .none: argo.color.interaction.accent
        case .quiet: argo.color.text.tertiary
        case .failure: argo.color.state.failure
        }
    }

    /// It says what it DOES and not what it interrupts. "Stop the Turn and send this" is two acts
    /// to read where the reader is making one decision, and the stopping is the means.
    static let steerLabel = "Send this follow-up now"
    static let cancelLabel = "Cancel the queued follow-up"
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

#Preview("Queued turn — being steered into the running Turn") {
    QueuedTurnChip(
        turn: QueuedTurn(text: "And when that is green, open the PR against main."),
        standing: .steering,
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
        standing: .notSent,
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
