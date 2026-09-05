import ArgoDesign
import SwiftUI

/// The remedy, beside the reading that asks for it. It draws an offer it was handed and judges
/// nothing — whether there is one, and how urgent, are `SessionHeaderProjection.handoff(from:)`'s.
/// The ink is the TIER's, and the button reads `handoff.isRunning` for whether a press is still
/// being answered (#1327) — the same fact `FeedWaitPlinth` stands on, rather than a state of its
/// own: neither view may say a handoff is running that the other does not.
package struct SessionHandoffButton: View {
    @Environment(\.argo) private var argo

    let handoff: SessionHeaderProjection.Handoff
    let run: () async -> Void

    package var body: some View {
        Button {
            Task { await run() }
        } label: {
            Text(handoff.isRunning ? handoff.runningLabel : handoff.label)
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
        .disabled(!handoff.isLaunchable || handoff.isRunning)
        // A remedy out of reach has to say what is in its way.
        .help(handoff.blocked ?? handoff.detail)
        .accessibilityLabel(handoff.isRunning ? handoff.runningLabel : handoff.label)
        .accessibilityHint(handoff.blocked ?? handoff.detail)
        // The branch is what gives way on this line (#502, story 25), never the remedy.
        .layoutPriority(1)
    }

    /// The tier's own tint at full strength — a button only exists past a line — dropping to the
    /// inert rung while it is out of reach or already running.
    private var ink: ArgoColor {
        handoff.isLaunchable && !handoff.isRunning
            ? handoff.tier.tint(in: argo.color)
            : argo.color.text.disabled
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(handoff: SessionHeaderProjection.Handoff, run: @escaping () async -> Void) {
        self.handoff = handoff
        self.run = run
    }
}
