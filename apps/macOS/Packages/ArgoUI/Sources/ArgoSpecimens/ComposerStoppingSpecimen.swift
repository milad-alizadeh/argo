import ArgoDesign
import ArgoUI
import SwiftUI

/// The composer with a Stop that can actually be PRESSED — the running Session, the draft and the
/// interrupt all held here, so a click on the control walks the same transition the shell walks
/// (#541).
///
/// Its own entry rather than a flag on `ComposerSpecimen`, because what it holds is not a draft: it
/// is the Session's `isRunning`, and every other composer case states that once and never moves it.
/// The transition is the whole point — a still of either end proves nothing about the field being
/// typeable across it, which is what `ComposerStopE2ETests` is here to press.
struct ComposerStoppingSpecimen: View {
    /// Where the window's opening focus is parked, for `ComposerSpecimen`'s reason: left to itself
    /// the field is the first key view, and macOS select-alls a focused field's text.
    @FocusState private var parked: Bool
    @State private var draft = ComposerDraft()
    /// Whether the Turn is still in flight. Stop turns it off, which is the record catching up —
    /// in the shell that arrives from the Hub a moment later, and here it arrives at the click.
    @State private var isRunning = true

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            Color.clear
                .frame(height: ArgoStroke.border)
                .focusable()
                .focused($parked)
                .focusEffectDisabled()
            SessionComposer(
                composer: isRunning ? ComposerSpecimen.running : ComposerSpecimen.composer,
                intents: DeckIntents(send: { _, _ in }, stop: stop, draft: $draft),
            )
            .padding(.horizontal, ArgoSpacing.section)
            .padding(.bottom, ArgoSpacing.loose)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .argoDeckSurface()
        .defaultFocus($parked, true)
    }

    private func stop() {
        isRunning = false
    }
}
