import ArgoAtoms
import ArgoDesign
import SwiftUI

/// A glyph that takes text to the pasteboard and answers with a tick.
struct ArgoCopyButton: View {
    /// Seconds the tick stands before the control goes back to offering the copy. Long enough to
    /// read, short enough to be gone before the reader wants the control again.
    static let acknowledgement = 1.5

    @Environment(\.argo) private var argo

    let text: String
    /// What the control is called, spoken and on hover both — so a copy cannot be announced as one
    /// thing and tipped as another.
    let name: String
    /// The rung and the resting ink. Both vary because this sits on two grounds: inline in a panel
    /// header, and on a float of its own over the feed's prose, where the quietest rung would read
    /// as a disabled control.
    var size: ArgoIconSize = .inline
    var resting: ArgoColor?

    @State private var hasCopied = false

    var body: some View {
        Button(action: copy) {
            ArgoGlyph(hasCopied ? ArgoSymbol.chosen : ArgoSymbol.copyAddress, size)
                .foregroundStyle(hasCopied ? argo.color.interaction.accent : ink)
        }
        .buttonStyle(.plain)
        .help(name)
        .accessibilityLabel(name)
    }

    private var ink: ArgoColor {
        resting ?? argo.color.text.tertiary
    }

    private func copy() {
        ArgoPasteboard.put(text)
        hasCopied = true
        Task {
            try? await Task.sleep(for: .seconds(Self.acknowledgement))
            hasCopied = false
        }
    }
}
