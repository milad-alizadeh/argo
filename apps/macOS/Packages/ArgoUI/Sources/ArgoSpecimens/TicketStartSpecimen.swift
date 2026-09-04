import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// The room's toolbar Start, with the command it will send beside it (#899), and with nothing —
/// which is the ticket that matched no rule and opens an empty composer.
///
/// A specimen because no fixture reaches either state: `TicketsFixture` carries no ticket labelled
/// `bug` or `enhancement`, and a specimen checkout has no `docs/designs/` to read.
struct TicketStartSpecimen: View {
    private static let commands: [WorkCommand?] = [.implement, .designToCode, .grillMe, nil]

    /// The picker's act is inert: this specimen is about what the pill SAYS for each resolved
    /// command, and a menu that spawned would take the render off the screen it is shooting.
    private static func verbs(sending command: WorkCommand?) -> TicketsChromeIntents.Verbs {
        TicketsChromeIntents.Verbs(command: command)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            ForEach(Self.commands, id: \.self) { command in
                StartControl(verbs: Self.verbs(sending: command))
            }
        }
    }
}

#Preview("Start — the command it will send, and the ticket that asks for none") {
    TicketStartSpecimen()
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
