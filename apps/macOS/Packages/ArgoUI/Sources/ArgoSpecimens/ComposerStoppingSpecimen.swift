import ArgoUI
import SwiftUI

/// The composer with a Stop that can actually be PRESSED — the running Session, the draft and the
/// interrupt all held here, so a click on the control walks the same transition the shell walks
/// (#541).
///
/// Its own entry rather than a flag on `ComposerSpecimen`, because what it holds is not a draft: it
/// is the Session's `isRunning`, and every other composer case states that once and never moves it.
/// The transition is the whole point — a still of either end proves nothing about what survives it,
/// which is what `ComposerStopE2ETests` is here to press.
struct ComposerStoppingSpecimen: View {
    @State private var draft = ComposerDraft()
    /// Whether the Turn is still in flight. Stop turns it off, which is the record catching up —
    /// in the shell that arrives from the Hub a moment later, and here it arrives at the click.
    ///
    /// So this entry can show what STOP does and never what the shell's own status does after it:
    /// #1189's stuck Stop square is a fault in that reading, and nothing here can reproduce it.
    @State private var isRunning = true

    var body: some View {
        ComposerStage {
            SessionComposer(
                composer: isRunning ? ComposerSpecimen.running : ComposerSpecimen.composer,
                intents: DeckIntents(send: { _, _ in }, stop: stop, draft: $draft),
            )
        }
    }

    private func stop() {
        isRunning = false
    }
}
