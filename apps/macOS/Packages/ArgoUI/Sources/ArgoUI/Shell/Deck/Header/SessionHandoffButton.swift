import ArgoDesign
import SwiftUI

/// The remedy, beside the reading that asks for it. It draws an offer it was handed and judges
/// nothing — whether there is one, and how urgent, are `SessionHeaderProjection.handoff(from:)`'s.
/// The ink is the TIER's, and the button disables itself while a press is still being answered:
/// each press starts another handoff.
package struct SessionHandoffButton: View {
    @Environment(\.argo) private var argo

    let handoff: SessionHeaderProjection.Handoff
    let run: () async -> Void

    @State private var isRunning = false

    package var body: some View {
        HeaderCapsuleButton(label: label) {
            Task {
                isRunning = true
                await run()
                isRunning = false
            }
        }
    }

    /// The tier's own tint at full strength — a button only exists past a line — and the running
    /// word while a press is still being answered: each press starts another handoff. A remedy out
    /// of reach says what is in its way, and the shape it is drawn in greys it for us.
    private var label: HeaderCapsuleButton.Label {
        HeaderCapsuleButton.Label(
            word: isRunning ? handoff.runningLabel : handoff.label,
            ink: handoff.tier.tint(in: argo.color),
            detail: handoff.blocked ?? handoff.detail,
            isEnabled: handoff.isLaunchable && !isRunning,
        )
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(handoff: SessionHeaderProjection.Handoff, run: @escaping () async -> Void) {
        self.handoff = handoff
        self.run = run
    }
}
