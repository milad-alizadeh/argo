import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// What BOTH of the room's Start controls say — the mark, the word, and the command after it.
///
/// One view because there are two vessels and one verb: the pane header's Start (`StartControl`)
/// and the Next-up hero's (`NextUpStarter`) differ in the ground they sit on and in nothing else.
/// Said twice, the two spellings of one fact drift, which is how the hero came to draw the command
/// in place of the word while the toolbar drew it after.
///
/// The command sits in `text.tertiary` on `machineCaption`: it is what `Start` will do, not a
/// second control. Nothing is drawn where the ticket asks for none — `Start` alone is then the
/// whole truth, because the Session it opens will have an empty composer.
struct StartVerb: View {
    /// How much of the verb this caller draws. **Amended #1242**: in the pane header the command
    /// is its own segment — pressing it opens the skill picker — so the word half draws the mark
    /// and the word and stops. The hero has one target and still says the whole thing.
    ///
    /// A reading and not two views: the mark, the word and their spacing are the fact both draw,
    /// and splitting the view is how the two spellings drifted the first time.
    enum Says {
        /// The mark, the word, and the command after it.
        case whole
        /// The mark and the word. The command is drawn beside this by a control of its own.
        case word
    }

    @Environment(\.argo) private var argo

    let command: WorkCommand?
    var says = Says.whole

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(ArgoSymbol.startSession, .control)
            Text("Start")
                .argoText(ArgoTypography.control)
            if says == .whole, let command {
                StartCommandWord(command: command)
            }
        }
        .foregroundStyle(argo.color.text.secondary)
    }

    /// How either control is announced and helped. A press that silently dispatched one of five
    /// different jobs is a press nobody can aim, and a reader who cannot see the command has to be
    /// told it here or not at all.
    package static func spoken(_ command: WorkCommand?) -> String {
        guard let command else { return "Start a Session on this ticket, with an empty composer" }
        return "Start a Session on this ticket, on \(command.typed)"
    }
}

/// The command, set as the machine fact it is. One view because two controls draw it — the hero's
/// whole verb and the pane header's picker segment — and a command set two ways is one of them
/// waiting to go stale, which is the fault this file already exists to prevent.
struct StartCommandWord: View {
    @Environment(\.argo) private var argo

    let command: WorkCommand

    var body: some View {
        Text(command.typed)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.tertiary)
            .lineLimit(1)
            // The longest command is `/design-to-code`, and at the pane's 320 floor it wrapped to
            // two lines and took the chevron beside it off the baseline. A token is one word.
            .fixedSize()
    }
}
