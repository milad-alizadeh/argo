import ArgoDesign
import SwiftUI

/// The evidence panel's own control, at the trailing edge of the bar (#875 finding 5). Before it
/// the panel opened from a feed row and closed from its own header, and once closed there was no
/// way back to it without finding that row again.
///
/// A `Toggle` and not a `Button`: the button style draws its ON state itself, which is the whole of
/// "shows open and closed state" — and it is the same control the platform puts at this edge for a
/// right-hand column, so the reader has met it before.
package struct EvidenceToggle: View {
    /// The decision, already made — see `EvidenceToggling`.
    let toggling: EvidenceToggling
    let act: () -> Void

    package var body: some View {
        Toggle(isOn: pressed) {
            Label("Evidence", systemImage: ArgoSymbol.evidencePanel)
        }
        .toggleStyle(.button)
        .disabled(!toggling.canToggle)
        .help(toggling.help)
        .accessibilityLabel("Evidence panel")
        .accessibilityValue(toggling.isOpen ? "shown" : "hidden")
    }

    /// The reading is the source: what a press does is `EvidenceToggling`'s, so this writes the
    /// gesture rather than a value.
    private var pressed: Binding<Bool> {
        Binding(get: { toggling.isOpen }, set: { _ in act() })
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(toggling: EvidenceToggling, act: @escaping () -> Void) {
        self.toggling = toggling
        self.act = act
    }
}
