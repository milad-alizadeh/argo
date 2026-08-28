import ArgoEngine
import SwiftUI

/// The Next-up hero's second verb (#899): start a Session on the pick, and SAY what it will send.
///
/// **A sibling of the card's own open Button, never a control inside its label.** A `Button` nested
/// in another `Button`'s label is drawn and not hittable — the outer one takes every click. So
/// `NextUpCard` draws this twice: hidden inside the label, where it holds the space, and live in an
/// overlay over that space. Both are inset by `ArgoTicketsSidebar.heroPadding`, which is what puts
/// the two in one place with nothing measured.
///
/// `.quiet` and not the card's own style: it sits ON the raised card, so it needs a ground of its
/// own to read as a second target rather than as a line of the card's text.
struct NextUpStarter: View {
    /// What the press will send, and `nil` where the pick asks for no command.
    let command: WorkCommand?
    var act: () -> Void = {}

    var body: some View {
        Button(action: act) {
            HStack(spacing: ArgoSpacing.snug) {
                ArgoGlyph(ArgoSymbol.startSession, ArgoTicketsChrome.iconSize)
                Text(words)
            }
        }
        .buttonStyle(.quiet)
        .help(spoken)
        .accessibilityLabel(spoken)
    }

    /// The command, before the press — a press that silently dispatched one of five different jobs
    /// would be one nobody could aim. A pick that asks for none says `Start` alone: the composer it
    /// opens will be empty, and a command name it never resolved would be a promise it cannot keep.
    private var words: String {
        command.map { "/\($0.rawValue)" } ?? "Start"
    }

    private var spoken: String {
        guard let command else { return "Start a Session on this ticket, with an empty composer" }
        return "Start a Session on this ticket, on /\(command.rawValue)"
    }
}

#Preview("Next-up Start — the command, and the ticket that asks for none") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        NextUpStarter(command: .implement)
        NextUpStarter(command: .designToCode)
        NextUpStarter(command: nil)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
