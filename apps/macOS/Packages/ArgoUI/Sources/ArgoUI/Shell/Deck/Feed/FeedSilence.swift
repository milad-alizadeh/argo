import SwiftUI

/// A feed with no row in it. It says so, because a blank zone is indistinguishable from one that
/// failed to draw.
///
/// WHICH of the three empties it is comes off `FeedVacancy`, from the environment: a window with
/// Sessions and none chosen is not a window with no Sessions, and the words are the only thing on
/// screen that can tell them apart.
struct FeedSilence: View {
    @Environment(\.argo) private var argo
    @Environment(\.argoFeedVacancy) private var vacancy

    var body: some View {
        Text(vacancy.words)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.disabled)
    }
}

#Preview("Feed silence — a Session that has said nothing") {
    FeedSilence()
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed silence — a roster with Sessions on it and none chosen") {
    FeedSilence()
        .padding(ArgoSpacing.region)
        .environment(\.argoFeedVacancy, .unselected)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed silence — no Sessions at all") {
    FeedSilence()
        .padding(ArgoSpacing.region)
        .environment(\.argoFeedVacancy, .noSessions)
        .argoDeckSurface()
        .argoAppearance()
}
