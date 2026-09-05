import ArgoDesign
import SwiftUI

/// The tab line's one control SHAPE: a word in an inked capsule over the neutral overlay step.
/// Extracted on the second copy (#1335) — the ink is spent on the word and its rim, never on the
/// ground, and both controls on this line spend it the same way.
///
/// It holds no state of its own: which word is drawn, which ink it takes and whether the press is
/// available are the caller's, because each control ages its own press differently.
package struct HeaderCapsuleButton: View {
    @Environment(\.argo) private var argo

    /// What the button says and how it is read — one value, because no call site names the word
    /// without the ink it is set in and the sentence a reader hovers for.
    package struct Label: Equatable {
        let word: String
        let ink: ArgoColor
        /// The whole tooltip, and the hint a screen reader hears. One sentence.
        let detail: String
        /// `false` draws the control DISABLED rather than dropping it: a control out of reach has
        /// to say what is in its way, which `detail` is then carrying.
        let isEnabled: Bool

        package init(word: String, ink: ArgoColor, detail: String, isEnabled: Bool = true) {
            self.word = word
            self.ink = ink
            self.detail = detail
            self.isEnabled = isEnabled
        }
    }

    let label: Label
    let run: () -> Void

    package var body: some View {
        Button(action: run) {
            Text(label.word)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(ink)
                .lineLimit(1)
                .padding(.horizontal, ArgoSpacing.snug)
                .padding(.vertical, ArgoSpacing.hair)
                // The neutral step every float lands on.
                .background(argo.color.surface.overlay, in: .capsule)
                .overlay {
                    Capsule().strokeBorder(ink, lineWidth: ArgoStroke.border)
                }
        }
        .buttonStyle(.plain)
        .disabled(!label.isEnabled)
        .help(label.detail)
        .accessibilityLabel(label.word)
        .accessibilityHint(label.detail)
        // The branch is what gives way on this line (#502, story 25), never a control.
        .layoutPriority(1)
    }

    /// The caller's ink at full strength, dropping to the inert rung while it is out of reach.
    private var ink: ArgoColor {
        label.isEnabled ? label.ink : argo.color.text.disabled
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(label: Label, run: @escaping () -> Void) {
        self.label = label
        self.run = run
    }
}
