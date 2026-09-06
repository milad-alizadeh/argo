import ArgoDesign
import AtlasLayout
import SwiftUI

// Every render of `AtlasView`, beside the view rather than inside it, for `AtlasRoomPreviews`'
// reason: there are more states of this map worth looking at than there is view to draw them, and
// a file whose renders outgrew its code is one nobody can read the code of.

/// The two states the map has: one with ground to stand a city on, and one with none.
///
/// The empty case is the one worth a render rather than an assertion — a 0×0 rectangle draws
/// nothing, and nothing is indistinguishable from a view that failed to paint until you have
/// looked at the tiled one beside it.
private struct AtlasPreview: View {
    let plan: AtlasPlan
    var standing: AtlasStanding = .city
    var folder: String?
    var orientation: AtlasOrientation = .opening
    var marks: AtlasMarks = .none

    /// One file open and nothing to close it with — what every preview of a marked map takes. A
    /// helper rather than the value written out three times: `AtlasFocus` carries a closure, so
    /// there is no `let` at file scope that can hold one.
    static func opened(_ path: String, ties: AtlasTies = .none) -> AtlasMarks {
        AtlasMarks(focus: AtlasFocus(open: path) { _ in }, ties: ties)
    }

    var body: some View {
        AtlasView(
            plan: plan,
            standing: standing,
            standingIn: folder,
            orientation: orientation,
            marks: marks,
        )
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
    }
}

/// A plan with ground to stand a city on: two plates, one nested, and three files at three
/// different heights so a projection that lost the third channel is visible rather than plausible.
private let previewPlan = AtlasPlan(
    extent: CGSize(width: 620, height: 400),
    plates: [
        .init(path: "argo", rect: CGRect(x: 0, y: 0, width: 620, height: 400), depth: 0),
        .init(path: "argo/rules", rect: CGRect(x: 2, y: 8, width: 300, height: 390), depth: 1),
    ],
    tiles: [
        .init(
            path: "argo/rules/house.md",
            rect: CGRect(x: 4, y: 16, width: 296, height: 200),
            band: .hot,
            height: 60,
        ),
        .init(
            path: "argo/rules/swift.md",
            rect: CGRect(x: 4, y: 216, width: 296, height: 180),
            band: .quiet,
            height: 8,
        ),
        .init(
            path: "argo/README.md",
            rect: CGRect(x: 302, y: 8, width: 316, height: 390),
            band: .middling,
            height: 26,
        ),
    ],
    legend: AtlasLegend(measure: "lines", greatestQuiet: 61, leastHot: 480),
)

#Preview("Atlas — the city") {
    AtlasPreview(plan: previewPlan)
}

// The other end of the one camera, and the picture the identity is about: the same plan, drawn
// straight down.
#Preview("Atlas — the map tiled flat") {
    AtlasPreview(plan: previewPlan, standing: .flat)
}

// A reader standing inside a folder (#1490). The claim to look at against the treemap preview
// above: it is the SAME tiling, and `argo/rules` is the same two rectangles in the same proportions
// — only larger, because the camera seated onto that plate rather than the map re-tiling into it.
#Preview("Atlas — standing inside a folder") {
    AtlasPreview(plan: previewPlan, standing: .flat, folder: "argo/rules")
}

#Preview("Atlas — the empty map") {
    AtlasPreview(plan: .empty)
}

// The city part way out of its plates (#1421). A still of a moving thing, and the one frame worth
// keeping: the middle of the plan is up, the edges are still flat, and the wave between them is
// what says the city opened from its centre rather than lifting all at once.
#Preview("Atlas — the city half risen") {
    AtlasPreview(plan: previewPlan, standing: AtlasStanding(relief: 1, rise: 0.5))
}

// A turn and a tilt away from the opening view — the reader having driven the camera (#1152).
#Preview("Atlas — the city, turned") {
    AtlasPreview(plan: previewPlan, orientation: AtlasOrientation(yaw: 2.1, pitch: 1.1))
}

// The file a reader has open, traced (#1154). The claim to look at: the marked volume is the same
// colour it was before it was marked — the band IS the measure, and a mark that repainted it would
// destroy the fact the reader opened it to read.
#Preview("Atlas — a file open, traced on the city") {
    AtlasPreview(plan: previewPlan, marks: AtlasPreview.opened("argo/rules/house.md"))
}

// The same mark at the other end of the one camera, where every standing edge of a box projects
// onto its own footprint and the trace is the rectangle alone.
#Preview("Atlas — a file open, traced on the treemap") {
    AtlasPreview(
        plan: previewPlan,
        standing: .flat,
        marks: AtlasPreview.opened("argo/rules/house.md"),
    )
}

/// Three files that keep changing together, at three strengths, so a cord drawn without its own
/// strength is visible rather than plausible (#1160).
private let previewTies = AtlasTies(
    couplings: [
        AtlasCoupling(
            first: "argo/rules/house.md", second: "argo/rules/swift.md", strength: 0.82,
        ),
        AtlasCoupling(first: "argo/rules/house.md", second: "argo/README.md", strength: 0.44),
        AtlasCoupling(first: "argo/rules/swift.md", second: "argo/README.md", strength: 0.12),
    ],
    isOn: true,
)

// The strongest ties across the whole map, in the city: bowed UP off the ground they would
// otherwise run along, so a cord reads as a thing over the map rather than as a seam of it.
#Preview("Atlas — the strongest ties, on the city") {
    AtlasPreview(plan: previewPlan, marks: AtlasMarks(ties: previewTies))
}

// The same ties at the other end of the one camera. There is no up here, so the bow rotates into
// the plane — always to the same side of its own chord, which is what fans a bundle out instead of
// laying every cord in it on one shape.
#Preview("Atlas — the strongest ties, on the treemap") {
    AtlasPreview(plan: previewPlan, standing: .flat, marks: AtlasMarks(ties: previewTies))
}

// A pinned file's own ties, with the switch OFF: the reader pointed at a file and asked what it
// changes with, which is a question the switch does not answer. The two cords leave the traced
// volume and nothing else on the map is drawn.
#Preview("Atlas — a pinned file's own ties") {
    AtlasPreview(
        plan: previewPlan,
        marks: AtlasPreview.opened(
            "argo/rules/house.md",
            ties: AtlasTies(couplings: previewTies.couplings, isOn: false),
        ),
    )
}
