import ArgoEngine
import SwiftUI

/// The room's toolbar Start, with the command it will send beside it (#899), and with nothing —
/// which is the ticket that matched no rule and opens an empty composer.
///
/// A specimen because no fixture reaches either state: `TicketsFixture` carries no ticket labelled
/// `bug` or `enhancement`, and a specimen checkout has no `docs/designs/` to read.
struct TicketStartSpecimen: View {
    private static let commands: [WorkCommand?] = [.implement, .designToCode, .grillMe, nil]

    /// The two link verbs are PRESENT here, so the row renders the one a bound Project draws. Left
    /// absent they render disabled (#872), which is a different state and not the one this specimen
    /// is about.
    private static func verbs(sending command: WorkCommand?) -> TicketsToolbarIntents.Verbs {
        TicketsToolbarIntents.Verbs(command: command, openOnHost: {}, copyLink: {})
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
