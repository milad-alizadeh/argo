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
    @Environment(\.argoReduceMotion) private var reduceMotion

    private let plan: AtlasPlan

    /// Where the reader is looking at the plan from: how much of the map is standing up, which way
    /// it is turned, and the folder the camera is seated onto (#1152, #1421, #1490). It has no
    /// default — `relief` inside it is the one thing that decides which of the two readings reaches
    /// the screen.
    ///
    /// `var` rather than `let`: `viewpoint.standing` is the whole of `animatableData` below, which
    /// is what lets a caller drive relief and rise through `withAnimation` and have every frame in
    /// between drawn as its own city, rather than a jump from one end to the other. The rise is ONE
    /// number for the whole map — the stagger that opens the city from its centre is not in it at
    /// all, and each box works its own phase out against where it stands, in `AtlasVolume.metal`.
    ///
    /// A parameter rather than state for `marks`' reason: where the reader is standing is read in
    /// the rail and in the trail beside this view, and the three have to be naming one folder.
    private var viewpoint: AtlasViewpoint

    /// The file under the pointer, read off the id target the frame was drawn into (#1153). State
    /// rather than a parameter: it is a fact about a picture only this view has drawn, and a
    /// caller cannot hold what it has not seen.
    @State private var hovered: String?

    /// Whether the pointer is over the map at all (#1425). What the travel along the cords runs
    /// on: a loop is the one thing on this surface that keeps a view unpaused with nobody looking,
    /// and a map in a window the reader has left alone should cost what a still costs.
    ///
    /// Not `hovered`: that is nil over the desktop between two boxes, and light that stopped every
    /// time the pointer crossed a gap would report the dependency being live as flicker.
    @State private var pointing = false

    /// What is marked on the map: the file the reader has open — marked without being repainted —
    /// and the ties drawn over the picture (#1154, #1160).
    ///
    /// A parameter rather than state, unlike `hovered`, because both outlive this view. What is
    /// open is read in a column of its own and the two have to be looking at one file; the switch
    /// that draws the ties is in the sidebar, which is a column this one cannot hold state for.
    private let marks: AtlasMarks

    public init(plan: AtlasPlan, viewpoint: AtlasViewpoint, marks: AtlasMarks = .none) {
        self.plan = plan
        self.viewpoint = viewpoint
        self.marks = marks
    }

    /// Solved fresh from the viewpoint on every draw rather than stored, because `standing` inside
    /// it changes under `Animatable` between the values a caller ever set it to.
    ///
    /// ONE projection, handed to the shader and to everything drawn over it. A second solved
    /// beside it is a second camera to drift, which is the class of defect the id target exists to
    /// remove.
    private var projection: AtlasProjection {
        let camera = AtlasCamera(
            relief: viewpoint.standing.relief,
            orientation: viewpoint.orientation,
            over: plan.extent,
        )
        // The seat the caller is actually at wins over the one the folder names, and the two only
        // ever differ while a flight is in the air (#1423).
        // A turned camera is not seated at all — `AtlasProjection` refuses one, on the terms
        // `AtlasFit.seat` refuses to solve one — so the flip's framing is re-solved from the whole
        // picture at each relief rather than lerped between the two ends of it, which matters
        // because `animatableData` writes a seat on every frame.
        guard let seat = viewpoint.seat else {
            return AtlasProjection(
                of: plan,
                through: camera,
                rising: viewpoint.standing.rise,
                standingIn: viewpoint.folder,
            )
        }
        return AtlasProjection(
            of: plan, through: camera, rising: viewpoint.standing.rise, seatedAt: seat,
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
                    // The strip arrives and leaves on the naming role's own clock (#1425), driven
                    // from HERE rather than from a modifier over the overlay: what the transition
                    // needs is an animation in scope at the moment the value changes, and the
                    // moment is this closure. Reduce Motion resolves to no animation, which is the
                    // cut the role asks for rather than a branch this view holds.
                    resolve: { path in
                        withAnimation(ArgoMotion.naming.resolved(reduceMotion: reduceMotion)) {
                            hovered = path
                        }
                    },
                    pick: marks.focus.clicked,
                )
            }
            // Over the surface and under the mark: a cord belongs to the picture the way the
            // trace does, and the trace is the nearer of the two to what the reader opened.
            .overlay {
                AtlasTieCords(
                    projection: projection,
                    ties: marks.ties,
                    open: marks.focus.open,
                    travelling: pointing,
                )
            }
            // Over the cords and under the words: the mark belongs to the picture, and a name
            // the reader is reading must not be crossed by an edge.
            .overlay {
                AtlasOpenTrace(projection: projection, open: marks.focus.open)
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
                //
                // It fades rather than cutting (#1425). A name is the shortest role on the map for
                // the reason it is here at all: the pointer moves constantly, and a strip that
                // took as long to arrive as the box under it takes to move would read as lag.
                // Moving from one box to another rewrites the strip in place — the fade is the
                // strip arriving and leaving, not the name changing.
                if let hovered {
                    AtlasHoverName(path: hovered)
                        .frame(maxWidth: AtlasHoverName.width(over: plan.extent.width))
                        .padding(.top, ArgoSpacing.base)
                        .transition(.opacity)
                }
            }
            .overlay {
                // Only flat. A name is laid out on the ground, and turned, every one of them would
                // sit where its folder used to be — a caption over a building it does not name is
                // worse than no caption. The city gets its names when something can place them in
                // the picture rather than on the ground.
                //
                // CLIPPED, because a descent seats the camera on one plate (#1490) and the plates
                // outside it run off the stage: the shader stops at the drawable's edge and words
                // drawn over it do not, so a folder nobody can see would caption the rail.
                if projection.camera.isFlat {
                    AtlasPlateNames(projection: projection)
                        .clipped()
                }
            }
            .frame(width: plan.extent.width, height: plan.extent.height)
            // Whether anybody is looking at the map, which is what the cords' travel runs on
            // (#1425). Over the whole stage rather than over the cords, which are a layer with no
            // area of their own to be entered — and a pointer resting on a box between two cords
            // is a reader looking at the map.
            //
            // CONTINUOUS rather than `onHover`, which fires on crossing the edge alone: a map that
            // appears under a pointer already sitting still — a tab switched back to, a filter
            // that rebuilt the view, a window opened under the cursor — never crossed one, and the
            // cords would stay dark until the reader thought to move the mouse.
            .onContinuousHover { pointing = $0 != .ended }
    }
}

extension AtlasView: @MainActor Animatable {
    /// The two scalars the map is drawn from, and nothing else. SwiftUI interpolates them between
    /// an old value and a new one over whatever animation a caller's `withAnimation` set, and
    /// every step lands back in `camera` and in the rise above — so a city-to-treemap toggle
    /// tweens the whole projection, and a rise tweens the whole city's climb, rather than either
    /// cutting between two static pictures. No animation at the call site means no interpolation
    /// here either, which is what makes Reduce Motion's answer "call it with none" rather than a
    /// branch this view has to hold.
    ///
    /// A PAIR rather than two `Animatable` views, because they are one picture: the two run on
    /// their own clocks and a reader who flips the map mid-rise is owed one city doing both, not
    /// a flip that cancels a climb. The camera's own seat runs on a third clock and joins them for
    /// the same reason (#1423): a reader who descends mid-rise is owed one city doing both.
    ///
    /// The seat is carried as three scalars rather than as the value, because the value is
    /// optional and `AnimatablePair` has no way to spell "not flying". A caller at rest passes
    /// none, this reads the seat the folder names, and every frame it writes back is a real one —
    /// so a `withAnimation` STARTS a flight from wherever the camera was, which is what makes a
    /// second descent retarget rather than jump.
    public var animatableData: AtlasMoving {
        get {
            AtlasMoving(
                AnimatablePair(viewpoint.standing.relief, viewpoint.standing.rise),
                AnimatablePair(
                    AnimatablePair(seated.middle.x, seated.middle.y), seated.zoom,
                ),
            )
        }
        set {
            viewpoint.standing = AtlasStanding(
                relief: newValue.first.first, rise: newValue.first.second,
            )
            viewpoint.seat = AtlasSeat(
                middle: CGPoint(
                    x: newValue.second.first.first, y: newValue.second.first.second,
                ),
                zoom: newValue.second.second,
            )
        }
    }

    /// Where the camera is now: the seat it has been flown to, or the one the folder names for a
    /// camera that has not been flown anywhere. Read through the projection rather than solved
    /// again, so the number an animation starts from is the number the picture was drawn with.
    private var seated: AtlasSeat {
        viewpoint.seat ?? AtlasFit.seat(
            framing: plan, through: projection.camera, into: plan.extent,
            standingIn: viewpoint.folder,
        )
    }
}

/// The five scalars one frame of the map is drawn from: how much of the third dimension is left,
/// how far the boxes have climbed, and the three the camera's seat is made of.
///
/// A nest of `AnimatablePair` rather than a `VectorArithmetic` of our own, because `AtlasStanding`
/// clamps its ends — and a type that clamps cannot honestly claim the additive identity a vector
/// space is defined by. The clamp is what keeps a NaN out of the shader, so the nest is the
/// cheaper of the two prices.
public typealias AtlasMoving = AnimatablePair<
    AnimatablePair<Double, Double>,
    AnimatablePair<AnimatablePair<CGFloat, CGFloat>, CGFloat>,
>
