import ArgoDesign
import ArgoEngine
import SwiftUI

/// The Next-up hero's second verb (#899): start a Session on the pick, and say what it will send.
///
/// **A sibling of the card's own open Button, never a control inside its label.** A `Button` nested
/// in another `Button`'s label is drawn and not hittable — the outer one takes every click. So
/// `NextUpCard` draws this twice: hidden inside the label, where it holds the space, and live in an
/// overlay over that space. Both are inset by `ArgoTicketsSidebar.heroPadding`, which is what puts
/// the two in one place with nothing measured.
///
/// It carries its own vessel (`NextUpStarterStyle`), because it sits ON the raised card and has to
/// read as a second target rather than as a line of the card's text.
struct NextUpStarter: View {
    /// What the press will send, and `nil` where the pick asks for no command.
    let command: WorkCommand?
    var act: () -> Void = {}

    var body: some View {
        Button(action: act) {
            StartVerb(command: command)
        }
        .buttonStyle(NextUpStarterStyle())
        .help(StartVerb.spoken(command))
        .accessibilityLabel(StartVerb.spoken(command))
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
