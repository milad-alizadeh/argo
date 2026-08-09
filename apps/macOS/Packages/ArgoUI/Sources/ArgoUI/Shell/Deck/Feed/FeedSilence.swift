import SwiftUI

/// A feed with no row in it. It says so, because a blank zone is indistinguishable from one that
/// failed to draw.
///
/// A claim about this SURFACE and not about the Session: an agent can be busy in kinds this feed
/// does not draw yet, and "nothing said" would be a reading of the record rather than of the feed.
struct FeedSilence: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Text("Nothing to read yet")
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
