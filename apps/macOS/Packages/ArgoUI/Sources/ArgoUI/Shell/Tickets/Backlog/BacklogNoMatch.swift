import ArgoDesign
import SwiftUI

/// What the list pane says where the query matched nothing (#873). Inside the pane rather than one
/// of `TicketsRoomVacancy`'s three, which replace the whole deck.
struct BacklogNoMatch: View {
    @Environment(\.argo) private var argo

    /// The sentence, from `TicketsChromeProjection` — it quotes the query and names the view.
    let stated: String

    var body: some View {
        Text(stated)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.tertiary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, ArgoSpacing.region)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
}

#Preview("Backlog — the query matched nothing") {
    BacklogNoMatch(stated: "No ticket in All open matches “kubernetes”.")
        .frame(width: ArgoBacklogList.width, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
