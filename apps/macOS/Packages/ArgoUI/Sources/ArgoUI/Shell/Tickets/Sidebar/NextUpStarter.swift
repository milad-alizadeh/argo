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
    /// The pick this starts, which the label names (#1682). Not optional, unlike the reading
    /// `StartVerb.spoken` takes: the card IS a pick, so it always has a number.
    let ticket: Int
    var act: () -> Void = {}

    var body: some View {
        Button(action: act) {
            StartVerb(command: command)
        }
        .buttonStyle(NextUpStarterStyle())
        .help(StartVerb.spoken(command, on: ticket))
        .accessibilityLabel(StartVerb.spoken(command, on: ticket))
    }
}

#Preview("Next-up Start — the command, and the ticket that asks for none") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        NextUpStarter(command: .implement, ticket: 899)
        NextUpStarter(command: .designToCode, ticket: 1526)
        NextUpStarter(command: nil, ticket: 1682)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
