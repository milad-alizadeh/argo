import SwiftUI

/// The remedy, beside the reading that asks for it. It draws an offer it was handed and judges
/// nothing — whether there is one, and how urgent, are `SessionHeaderProjection.handoff(from:)`'s.
/// The ink is the TIER's, and the button disables itself while a press is still being answered:
/// each press starts another handoff.
struct SessionHandoffButton: View {
    @Environment(\.argo) private var argo

    let handoff: SessionHeaderProjection.Handoff
    let run: () async -> Void

    @State private var isRunning = false

    var body: some View {
        Button {
            Task {
                isRunning = true
                await run()
                isRunning = false
            }
        } label: {
            Text(isRunning ? handoff.runningLabel : handoff.label)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(ink)
                .lineLimit(1)
                .padding(.horizontal, ArgoSpacing.snug)
                .padding(.vertical, ArgoSpacing.hair)
                // The neutral step every float lands on: the tier's colour is spent on the word and
                // its rim, never the ground.
                .background(argo.color.surface.overlay, in: .capsule)
                .overlay {
                    Capsule().strokeBorder(ink, lineWidth: ArgoStroke.border)
                }
        }
        .buttonStyle(.plain)
        .disabled(!handoff.isLaunchable || isRunning)
        // A remedy out of reach has to say what is in its way.
        .help(handoff.blocked ?? handoff.detail)
        .accessibilityLabel(isRunning ? handoff.runningLabel : handoff.label)
        .accessibilityHint(handoff.blocked ?? handoff.detail)
        // The branch is what gives way on this line (#502, story 25), never the remedy.
        .layoutPriority(1)
    }

    /// The tier's own tint at full strength — a button only exists past a line — dropping to the
    /// inert rung while it is out of reach or already running.
    private var ink: ArgoColor {
        handoff.isLaunchable && !isRunning
            ? handoff.tier.tint(in: argo.color)
            : argo.color.text.disabled
    }
}

#Preview("Hand off — amber, red, and out of reach") {
    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        ForEach(Array(SessionHeaderFixture.handoffOffers.enumerated()), id: \.offset) { offer in
            SessionHandoffButton(handoff: offer.element, run: {})
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
