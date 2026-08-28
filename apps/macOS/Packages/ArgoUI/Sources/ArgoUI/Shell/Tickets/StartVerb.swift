import ArgoEngine
import SwiftUI

/// What BOTH of the room's Start controls say — the mark, the word, and the command after it.
///
/// One view because there are two vessels and one verb: the toolbar's Start (`StartControl`) and
/// the Next-up hero's (`NextUpStarter`) differ in the ground they sit on and in nothing else. Said
/// twice, the two spellings of one fact drift, which is how the hero came to draw the command in
/// place of the word while the toolbar drew it after.
///
/// The command sits in `text.tertiary` on `machineCaption`: it is what `Start` will do, not a
/// second control. Nothing is drawn where the ticket asks for none — `Start` alone is then the
/// whole truth, because the Session it opens will have an empty composer.
struct StartVerb: View {
    @Environment(\.argo) private var argo

    let command: WorkCommand?

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(ArgoSymbol.startSession, ArgoTicketsChrome.iconSize)
            Text("Start")
                .argoText(ArgoTypography.control)
            if let command {
                Text(command.typed)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
        }
        .foregroundStyle(argo.color.text.secondary)
    }

    /// How either control is announced and helped. A press that silently dispatched one of five
    /// different jobs is a press nobody can aim, and a reader who cannot see the command has to be
    /// told it here or not at all.
    static func spoken(_ command: WorkCommand?) -> String {
        guard let command else { return "Start a Session on this ticket, with an empty composer" }
        return "Start a Session on this ticket, on \(command.typed)"
    }
}
