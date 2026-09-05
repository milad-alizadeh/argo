import ArgoDesign
import AtlasLayout
import SwiftUI

/// The Atlas: a volume per file, standing as tall as its measure and painted in its band's colour,
/// the folder plates under them carrying their names, and the key that says what the colour is
/// worth (#1147, stood up at #1150).
///
/// ONE camera draws both readings. `relief` runs 1 to 0 — at 1 the city, at 0 the treemap — and
/// there is no second view here, only that parameter.
///
/// Lit by one warm key and one cool fill, never at the cost of a band: `AtlasVolume.metal` states
/// the rule in full, and `AtlasLighting` is what answers it (#1151).
///
/// The rectangles are Metal and the words are SwiftUI, which is the split every part of this view
/// follows: the GPU draws the city, and the one thing a GPU has no cheap answer for — a name that
/// has to be elided when it does not fit — is drawn over it by the layer that measures text.
///
/// The ground is a `Rectangle` behind the `MTKView` rather than only the view's clear colour,
/// because every way Metal can be absent — no device, no compiled shader, no library — resolves to
/// a surface that draws nothing. Degrade-down: the map's floor with no city on it is a state the
/// app can honestly show, and a blank hole is not.
public struct AtlasView: View {
    @Environment(\.argo) private var argo

    private let plan: AtlasPlan
    /// `relief` is 1 for the city and 0 for the treemap, and it has no default: it is the one thing
    /// that decides which of the two readings reaches the screen. `var` rather than `let`: this is
    /// the whole of `animatableData` below, which is what lets a caller drive it through
    /// `withAnimation` and have every frame in between drawn as its own camera, rather than a jump
    /// from one end to the other (#1152).
    private var relief: Double
    /// The city's own turn and tilt (#1152). Not animated here — a drag or a key press moves this
    /// live, one frame at a time, and a caller re-rendering this view on every one of those frames
    /// is a rate `Animatable` has no reason to also own.
    private let orientation: AtlasOrientation

    /// The file under the pointer, read off the id target the frame was drawn into (#1153). State
    /// rather than a parameter: it is a fact about a picture only this view has drawn, and a
    /// caller cannot hold what it has not seen.
    @State private var hovered: String?

    /// The file the reader has open, marked here without being repainted, and what a click means
    /// (#1154). A parameter rather than state, unlike `hovered`: what is open outlives this view —
    /// the reading is drawn in a column of its own, and both have to be looking at one file.
    private let focus: AtlasFocus

    public init(
        plan: AtlasPlan,
        relief: Double,
        orientation: AtlasOrientation = .opening,
        focus: AtlasFocus = .none,
    ) {
        self.plan = plan
        self.relief = relief
        self.orientation = orientation
        self.focus = focus
    }

    /// Solved fresh from `relief` and `orientation` on every draw rather than stored, because
    /// `relief` changes under `Animatable` between the values a caller ever set it to.
    ///
    /// ONE projection, handed to the shader and to everything drawn over it. A second solved
    /// beside it is a second camera to drift, which is the class of defect the id target exists to
    /// remove.
    private var projection: AtlasProjection {
        AtlasProjection(
            of: plan,
            through: AtlasCamera(relief: relief, orientation: orientation, over: plan.extent),
        )
    }

    /// The map alone. The key that says what the colour is worth is a section of the sidebar now,
    /// beside the channel that decides it (#1161) — the design puts nothing over the stage but the
    /// picture and the camera.
    public var body: some View {
        map
    }

    private var map: some View {
        let projection = projection
        return Rectangle()
            .fill(argo.color.atlas.materials.desktop)
            .overlay {
                AtlasSurface(
                    projection: projection,
                    pigments: AtlasPigments(argo.color.atlas, rim: argo.color.edge.hairline),
                    resolve: { hovered = $0 },
                    pick: focus.clicked,
                )
            }
            // Over the surface and under the words: the mark belongs to the picture, and a name
            // the reader is reading must not be crossed by an edge.
            .overlay {
                AtlasOpenTrace(projection: projection, open: focus.open)
            }
            .overlay(alignment: .top) {
                // Top centre, because both top corners of the stage are already spoken for. It
                // speaks only when there is a file to name: a strip standing empty over the map
                // would be a second thing to read that says nothing.
                //
                // The design's own rule is narrower — the bar speaks only where the box could not
                // carry its own name — and nothing here has to test for that, because no box on
                // this map carries one. `AtlasPlateNames` names FOLDERS, and only flat; a file is
                // never captioned where it stands, so the bar is the only answer there is.
                if let hovered {
                    AtlasHoverName(path: hovered)
                        .frame(maxWidth: AtlasHoverName.width(over: plan.extent.width))
                        .padding(.top, ArgoSpacing.base)
                }
            }
            .overlay {
                // The names are laid out in PLAN coordinates, which is the map seen straight down.
                // Turned, every one of them would sit where its folder used to be — a caption over
                // a building it does not name is worse than no caption. The city gets its names
                // when something can place them in the picture rather than in the plan.
                if projection.camera.isFlat {
                    AtlasPlateNames(plates: plan.plates)
                }
            }
            .frame(width: plan.extent.width, height: plan.extent.height)
    }
}

extension AtlasView: @MainActor Animatable {
    /// `relief` alone. SwiftUI interpolates this between an old value and a new one over whatever
    /// animation a caller's `withAnimation` set, and every step lands back in `camera` above — so
    /// a city-to-treemap toggle tweens the whole projection rather than cutting between two static
    /// pictures. No animation at the call site means no interpolation here either, which is what
    /// makes Reduce Motion's answer "call it with none" rather than a branch this view has to hold.
    public var animatableData: Double {
        get { relief }
        set { relief = newValue }
    }
}

/// The two states the map has: one with ground to stand a city on, and one with none.
///
/// The empty case is the one worth a render rather than an assertion — a 0×0 rectangle draws
/// nothing, and nothing is indistinguishable from a view that failed to paint until you have
/// looked at the tiled one beside it.
private struct AtlasPreview: View {
    let plan: AtlasPlan
    var relief: Double = 1
    var orientation: AtlasOrientation = .opening
    var open: String?

    var body: some View {
        AtlasView(
            plan: plan,
            relief: relief,
            orientation: orientation,
            focus: AtlasFocus(open: open) { _ in },
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
    AtlasPreview(plan: previewPlan, relief: 0)
}

#Preview("Atlas — the empty map") {
    AtlasPreview(plan: .empty)
}

// A turn and a tilt away from the opening view — the reader having driven the camera (#1152).
#Preview("Atlas — the city, turned") {
    AtlasPreview(plan: previewPlan, orientation: AtlasOrientation(yaw: 2.1, pitch: 1.1))
}

// The file a reader has open, traced (#1154). The claim to look at: the marked volume is the same
// colour it was before it was marked — the band IS the measure, and a mark that repainted it would
// destroy the fact the reader opened it to read.
#Preview("Atlas — a file open, traced on the city") {
    AtlasPreview(plan: previewPlan, open: "argo/rules/house.md")
}

// The same mark at the other end of the one camera, where every standing edge of a box projects
// onto its own footprint and the trace is the rectangle alone.
#Preview("Atlas — a file open, traced on the treemap") {
    AtlasPreview(plan: previewPlan, relief: 0, open: "argo/rules/house.md")
}
