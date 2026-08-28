import SwiftUI

/// What the list pane says where the query matched nothing (#873).
///
/// **Inside the pane, never one of the room's vacancies.** `WorkRoomVacancy`'s three pages are
/// facts about the provider and they replace the whole deck; this is a fact about the query, and
/// replacing the deck over a typo would take the ticket beside it away too. Keeping it here is also
/// what keeps the row of controls standing — a search field that removes itself the moment it
/// matches nothing is a field nobody can clear.
struct BacklogNoMatch: View {
    @Environment(\.argo) private var argo

    /// The sentence, from `WorkChromeProjection` — it quotes the query and names the view, because
    /// those are the two things the reader can change.
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
