import ArgoEngine
import ArgoUI
import Foundation

/// The two inputs the shipping shell's Tickets room needs besides the listing (#820) — a Binding to
/// name at the foot, and a roster to read the claims off.
///
/// Beside the specimen rather than in `ShellPreview`: they exist to make ONE render reproducible,
/// and neither is a preview of the shell itself.
extension ConnectionHealthReading {
    /// A Ticket Binding that has read successfully — which is what draws the foot's dot at all.
    /// A Binding nothing has ever read through is honestly stateless, and that is a different
    /// render (`TicketsReadingLiveTests`).
    static let previewBound = ConnectionHealthReading(connections: [
        PortConnection(
            port: .ticket,
            account: AccountRecord(
                provider: .github, providerAccountID: "1", displayName: "milad-alizadeh",
            ),
            health: BindingHealth(fault: nil, lastSuccess: Date()),
        ),
    ])
}

extension CockpitPresentation {
    /// The preview roster put on the backlog it is drawn beside: three Sessions on the three
    /// tickets `TicketsFixture` spells `In progress`, so the rail's count is arithmetic over the
    /// room rather than a number the specimen states.
    ///
    /// The roster itself is not on screen in this room — the Work sidebar has the leading slot —
    /// so these three are read for their ticket links and nothing else.
    static let workingTheBacklog = CockpitPresentation(
        projects: previewProjects,
        activeProjectID: "argo",
        sessions: [388, 609, 763].map {
            Session(
                id: "claim-\($0)",
                title: "Working #\($0)",
                access: .managed,
                status: .running,
                work: .init(ticket: .linked(.init(number: $0))),
            )
        },
        checkout: .branch("main"),
        connection: .connected,
    )
}
