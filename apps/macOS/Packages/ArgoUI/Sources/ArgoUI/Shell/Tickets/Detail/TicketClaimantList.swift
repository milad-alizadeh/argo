import ArgoDesign
import SwiftUI

/// The live Sessions on one ticket, one per row, behind the head's count (#1092). Each row is a
/// route of its own, and each is led by the roster's own state dot — the same mark, in the same
/// ink, that says which Session is running everywhere else in this app.
///
/// Its own view rather than a closure inside the popover: a list nothing can render on its own is
/// a list no specimen can be shot of, and the whole point of it is being looked at.
package struct TicketClaimantList: View {
    @Environment(\.argo) private var argo

    package let claimants: [TicketClaims.Claimant]
    package var open: (CockpitPresentation.Session.ID) -> Void = { _ in }

    package var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            ForEach(claimants) { claimant in
                Button { open(claimant.id) } label: {
                    HStack(spacing: ArgoSpacing.tight) {
                        SessionStateIndicator(state: SessionState.role(for: claimant.status))
                        Text(claimant.name)
                            .argoText(ArgoTypography.rowMeta)
                            .foregroundStyle(argo.color.text.primary)
                            .lineLimit(1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(ArgoSpacing.loose)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        claimants: [TicketClaims.Claimant],
        open: @escaping (CockpitPresentation.Session.ID) -> Void = { _ in },
    ) {
        self.claimants = claimants
        self.open = open
    }
}

#Preview("Ticket claimant list — one running, one idle") {
    TicketClaimantList(claimants: [
        .init(id: "a", name: "Fix the generic node tree crash", status: .running),
        .init(id: "b", name: "/implement 272", status: .idle),
    ])
    .argoDeckSurface()
    .argoAppearance()
}
