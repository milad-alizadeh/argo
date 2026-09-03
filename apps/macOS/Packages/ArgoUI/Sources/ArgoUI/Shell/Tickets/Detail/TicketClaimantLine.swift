import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// Which live Session(s) are on this ticket, in the head where a reader deciding what to do about
/// it looks (#1092; `cockpit-work-room.md` — the head names its claimant). Absent with none — not
/// an empty row, the same rule every other absent fact in this head follows.
///
/// One claimant is a route: pressing it opens the Sessions room on that Session, the way
/// `TicketStart` already does after a spawn. Two or more is a fact the head states rather than a
/// route it cannot honestly offer — naming one of them silently would be a claim nobody made.
struct TicketClaimantLine: View {
    @Environment(\.argo) private var argo

    let claimants: [TicketClaims.Claimant]
    /// Inert by default, so a preview and a specimen draw the line without reaching for the shell.
    var openSession: (CockpitPresentation.Session.ID) -> Void = { _ in }

    var body: some View {
        if claimants.count == 1 {
            let claimant = claimants[0]
            Button { openSession(claimant.id) } label: {
                GlyphMarkLine(
                    symbol: ClaimMark.symbol, text: claimant.name,
                    ink: argo.color.interaction.accent,
                )
            }
            .buttonStyle(.plain)
            .help("Open \(claimant.name), the Session on this ticket")
        } else if claimants.count > 1 {
            GlyphMarkLine(
                symbol: ClaimMark.symbol, text: "\(claimants.count) Sessions are on this",
                ink: argo.color.text.tertiary,
            )
            .help("More than one live Session is on this ticket")
        }
    }
}

#Preview("Ticket claimant line — one, two, none") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        TicketClaimantLine(claimants: [.init(id: "a", name: "Fix login flow bug")])
        TicketClaimantLine(claimants: [
            .init(id: "a", name: "Fix login flow bug"),
            .init(id: "b", name: "/implement #1092"),
        ])
        TicketClaimantLine(claimants: [])
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
