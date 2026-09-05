import ArgoDesign
import AtlasLayout
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
/// `AtlasVolume` states: neither side can see the other's declaration, so `AtlasRiseTests` asserts
/// both halves — the offsets, and the curve. The expression below and the shader's are the same
/// one written twice, and only a test that knows what it should say can tell a drifted copy from
/// a deliberate one.
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
    /// The shallowest a file stands on this ground — where every box STARTS, rather than at
    /// nothing. `AtlasElevation.floorShare` exists to keep a roof off the exact plane of the plate
    /// under it, and a rise that began at zero would put every box in the map on that plane at
    /// once: coplanar with the ground it stands on, the depth buffer tears them both to shreds.
    /// Two units of a thousand reads as flat at every camera, which is what the design calls flat
    /// anyway.
    var floor: Float

    /// The map already standing at its measured heights. What every still frame draws, and what
    /// Reduce Motion cuts to: `ArgoMotion.rise` carries no reduced duration, so a reader with
    /// movement off is handed the settled city rather than a faster one.
    static let settled = AtlasRise(clock: 1, share: 0, reach: 1, floor: 0)

    /// The rise over one plan, at one point on its clock. `clock` is held to 0...1 by
    /// `AtlasProjection`, which is where it crosses into the drawing half; a second clamp here
    /// would be a second place to disagree about what the ends are.
    ///
    /// `reach` is never zero: a plan tiled into no ground would divide every box's distance by
    /// nothing, and one NaN in the vertex stage takes the whole city with it — the same guard
    /// `AtlasCamera.eye` keeps for the same reason.
    init(_ projection: AtlasProjection) {
        self.init(clock: projection.rise, over: projection.plan.extent)
    }

    init(clock: Double, over plan: CGSize) {
        self.clock = Float(clock)
        self.share = Float(ArgoMotion.risen.staggerShare)
        let diagonal = (plan.width * plan.width + plan.height * plan.height).squareRoot()
        self.reach = Float(max(diagonal / 2, 1))
        self.floor = Float(AtlasElevation.floor(of: plan))
    }

    private init(clock: Float, share: Float, reach: Float, floor: Float) {
        self.clock = clock
        self.share = share
        self.reach = reach
        self.floor = floor
    }

    /// How far the wave has to travel to reach a box: 0 at the middle of the plan and 1 at its
    /// corner. A SHARE of `reach` rather than a distance, which is the only thing the stagger is
    /// spread over and the reason the city opens rather than sweeping across.
    func wave(to point: SIMD2<Float>, from centre: SIMD2<Float>) -> Float {
        min(1, simd_distance(point, centre) / reach)
    }

    /// How tall one box STANDS this frame: its own measured height, climbed from the map's floor
    /// rather than from nothing.
    ///
    /// `min` on the way in, because a plan written by hand may put a box below the floor — the
    /// tiler never does — and a rise that lifted such a box before dropping it back would be a
    /// climb the wrong way round.
    func height(of measured: Float, at wave: Float) -> Float {
        let low = min(floor, measured)
        return low + (measured - low) * growth(at: wave)
    }

    /// The same, for one tile of a plan: the height it is STANDING at this frame. Named here
    /// rather than spelled out at the one call site, so the height the mark is drawn at and the
    /// height the shader raises the box to come out of one expression.
    func height(of tile: AtlasTile, about centre: CGPoint) -> CGFloat {
        let middle = SIMD2<Float>(Float(tile.rect.midX), Float(tile.rect.midY))
        let about = SIMD2<Float>(Float(centre.x), Float(centre.y))
        return CGFloat(height(of: Float(tile.height), at: wave(to: middle, from: about)))
    }

    /// The share of its own measured height a box at that distance stands at, this frame.
    ///
    /// Above 1 in the last third of a box's climb, and that is the point: the box overshoots its
    /// height and settles back onto it, which is what makes the city arrive rather than inflate.
    /// It is exactly 0 before the box's turn and exactly 1 after it, so the settled frame is the
    /// measured height itself rather than whatever the curve happened to leave.
    ///
    /// The overshoot is a BACK ease rather than `ArgoMotion.Curve.spring`, which the contract
    /// cannot bound: this curve is evaluated against a clock of known length, and the role's own
    /// duration is still the whole of what a reader waits.
    func growth(at wave: Float) -> Float {
        let climb = 1 - share
        guard climb > 0 else { return clock >= 1 ? 1 : 0 }
        let elapsed = (clock - wave * share) / climb
        guard elapsed > 0 else { return 0 }
        guard elapsed < 1 else { return 1 }
        // The back ease, as the prototype writes it (`docs/designs/cockpit-atlas.html`, `riseZ`).
        let overshoot: Float = 1.15
        let past = elapsed - 1
        return 1 + (overshoot + 1) * past * past * past + overshoot * past * past
    }
}
