import ArgoDesign
import CoreGraphics
import simd

/// The city standing up out of its plates (#1421).
///
/// One scalar for the whole map, and a phase each box works out for itself. The clock runs 0 to 1
/// over `ArgoMotion.risen.sweep` — a box starts when the wave reaches where it stands and climbs
/// over its own share of what is left, so the city opens from the middle of the plan outwards
/// rather than every box lifting together.
///
/// It mirrors the `AtlasRise` struct in `AtlasVolume.metal` field for field, on the terms
/// `AtlasVolume` states: neither side can see the other's declaration, and `AtlasVolumeTests`
/// asserts the offsets. `AtlasRiseTests` asserts the curve, which is the other half — the
/// expression below and the shader's are the same one written twice, and only a test that knows
/// what it should say can tell a drifted copy from a deliberate one.
struct AtlasRise {
    /// The role's whole clock: 0 the instant the first box leaves its plate, 1 once the last one
    /// has settled. Every box's own start and finish is a share of this and of nothing else, so a
    /// caller animating it linearly is the whole of what drives the rise.
    var clock: Float
    /// How much of `clock` is spent staggering rather than climbing — `ArgoMotion.risen`'s own
    /// arithmetic, carried across so the shader divides no two durations of its own.
    var share: Float
    /// What a box's distance from the middle of the plan is divided by: the plan's half-diagonal,
    /// so the furthest corner is the last to start and the wave is a PLAN measurement — the same
    /// at any zoom, and the same whatever the window is.
    var reach: Float

    /// The map already standing at its measured heights. What every still frame draws, and what
    /// Reduce Motion cuts to: `ArgoMotion.rise` carries no reduced duration, so a reader with
    /// movement off is handed the settled city rather than a faster one.
    static let settled = AtlasRise(clock: 1, share: 0, reach: 1)

    /// The rise over one plan, at one point on its clock.
    ///
    /// `reach` is never zero: a plan tiled into no ground would divide every box's distance by
    /// nothing, and one NaN in the vertex stage takes the whole city with it — the same guard
    /// `AtlasCamera.eye` keeps for the same reason.
    init(clock: Double, over plan: CGSize) {
        self.clock = Float(min(1, max(0, clock)))
        self.share = Float(ArgoMotion.risen.staggerShare)
        let diagonal = (plan.width * plan.width + plan.height * plan.height).squareRoot()
        self.reach = Float(max(diagonal / 2, 1))
    }

    private init(clock: Float, share: Float, reach: Float) {
        self.clock = clock
        self.share = share
        self.reach = reach
    }

    /// How far out from the middle of the plan a box stands, 0 at the centre and 1 at the corner
    /// — the only thing the stagger is spread over, and the reason the city opens rather than
    /// sweeping across.
    func distance(of point: SIMD2<Float>, from centre: SIMD2<Float>) -> Float {
        min(1, simd_distance(point, centre) / reach)
    }

    /// The share of its own measured height a box at that distance stands at, this frame.
    ///
    /// Above 1 in the last third of a box's climb, and that is the point: the box overshoots its
    /// height and settles back onto it, which is what makes the city arrive rather than inflate.
    /// It is exactly 0 before the box's turn and exactly 1 after it, so the settled frame is the
    /// measured height itself rather than whatever the curve happened to leave.
    ///
    /// The overshoot is a BACK ease, not a spring. `ArgoMotion.rise` is stated as an ease-out
    /// because `ArgoMotion.Curve.spring` spends its duration as SwiftUI's `response`, which is not
    /// when the box stops moving — a role the ceiling cannot bound. Nothing here has that problem:
    /// the curve is evaluated against a clock of known length, it reaches its height at the end of
    /// it and stays there, and the role's own duration is still the whole of what a reader waits.
    func growth(at distance: Float) -> Float {
        let climb = 1 - share
        guard climb > 0 else { return clock >= 1 ? 1 : 0 }
        let elapsed = (clock - distance * share) / climb
        guard elapsed > 0 else { return 0 }
        guard elapsed < 1 else { return 1 }
        // The back ease, as the prototype writes it (`docs/designs/cockpit-atlas.html`, `riseZ`).
        let overshoot: Float = 1.15
        let past = elapsed - 1
        return 1 + (overshoot + 1) * past * past * past + overshoot * past * past
    }
}
