import ArgoDesign
import AtlasFixtures
import AtlasLayout
import AtlasView
import SwiftUI

/// The camera part way to the folder the reader is descending into (#1423).
///
/// A still of a moving thing, and the one frame worth keeping: the layout has not changed under
/// the reader — every rectangle here is a rectangle of the settled map at another scale — and the
/// folder is most of the way to filling the stage. A cut has no frame like this at all, which is
/// what makes it the picture worth rendering rather than either end.
///
/// The share is a PARAMETER rather than a clock the specimen starts, for `AtlasMapSpecimen`'s
/// reason: a screenshot of a moving thing taken on a clock is a different picture every run.
struct AtlasFlightSpecimen: View {
    /// How far along the flight the frame is taken, 0 the whole repository and 1 the folder seated.
    var share: Double = 0.55

    /// The folder the camera is flying to. The deep one, so the seat is a real magnification and
    /// the two ends of the flight are visibly different pictures.
    var into = AtlasDescentPaths.deep

    let ground = CGSize(width: 1040, height: 660)

    var body: some View {
        AtlasView(
            plan: plan,
            viewpoint: AtlasViewpoint(standing: .flat, standingIn: into, seat: seat),
        )
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
    }

    /// The one tiling, laid out from the repository's root (#1490) — the same plan at both ends of
    /// the flight, which is the whole reason there is something to interpolate.
    var plan: AtlasPlan {
        guard let map = try? AtlasMapFixture.argo() else { return AtlasPlan(extent: ground) }
        return AtlasStandpoint(on: map).plan(by: AtlasMapSpecimen.channels, into: ground)
    }

    /// Part way between the two seats, by the same `lerp` `AtlasView.animatableData` drives — so
    /// this frame is one SwiftUI would have drawn rather than a picture that resembles one.
    var seat: AtlasSeat {
        AtlasSeat(standingIn: nil, of: plan)
            .lerp(to: AtlasSeat(standingIn: into, of: plan), share)
    }
}

#Preview("Atlas — the camera part way to a folder") {
    AtlasFlightSpecimen()
        .frame(width: 1100, height: 800)
        .argoAppearance()
}
