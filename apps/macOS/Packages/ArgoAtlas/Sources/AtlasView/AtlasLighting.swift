import ArgoDesign
import simd

/// The three fixed face factors the light model resolves to, and the wall's own contact term —
/// solved once from `ArgoLight`, in the box's own space rather than the camera's (#1151).
///
/// THIS CAMERA CANNOT TURN past the range `AtlasVolume.metal` draws — the yaw only ever runs 0 to
/// 45°, so the near corner and the two walls it shows (the -x one and the -y one) never change.
/// What each wall is lit by is therefore a property of the BOX, never of the eye watching it, and
/// solving it here once is what lets a fragment spend it as one multiply rather than run a dot
/// product a pixel. `AtlasLightingTests` is the Swift mirror of the numbers `AtlasVolume.metal`'s
/// fragment stage reads; nothing on the Metal side re-derives them.
///
/// Every term is a SCALAR — never a tinted vector landed on the pigment — because that is the one
/// way `ArgoLight`'s own rule (a lit face never turns its hue) can be true by construction rather
/// than by a render happening to look right. A lamp's tint says how warm or cool it reads, and
/// that becomes one number (`luminance(_:)`) before it ever touches a pigment.
struct AtlasLighting: Equatable {
    /// The roof: the flat face at the top of every plate and every file.
    var roof: Float
    /// The nearer of the two walls the fixed yaw ever shows — the one the key rakes across.
    var nearX: Float
    /// The other — the wall the key only grazes, lifted mostly by the fill.
    var nearY: Float
    /// The wall's own foot term, carried alongside rather than folded into `nearX`/`nearY`: it is
    /// a SECOND scalar, read along the wall's own height rather than picked by its face.
    var contactFoot: Float
    /// The key's own direction across the PLAN, normalised — which way a roof's sheen runs (#1600).
    /// A plan direction rather than a screen one, so turning the map turns which side of a roof is
    /// bright; the same number every cast shadow is thrown along (`AtlasShadow.decal`).
    var keyPlan: SIMD2<Float>
    /// How much of its own light the far side of a roof keeps: the roof's own `contactFoot`, and
    /// the third scalar the shader reads across a face rather than off it (#1600).
    var sheenFoot: Float

    /// Solved from the contract's own lamps. An ambient term has no direction, so it lights every
    /// face alike and is folded into all three before either directional lamp is added.
    /// `feet` is one parameter because it is one reading: how much of its own light a face keeps
    /// where the light runs out — a wall at its foot, a roof on the side away from the lamp.
    init(
        ambient: ArgoLight.Lamp,
        key: ArgoLight.Lamp,
        fill: ArgoLight.Lamp,
        feet: (contact: Double, sheen: Double),
    ) {
        let base = Self.strength(of: ambient)
        let keyDirection = Self.normalized(key.direction)
        let fillDirection = Self.normalized(fill.direction)
        let keyStrength = Self.strength(of: key)
        let fillStrength = Self.strength(of: fill)

        func factor(_ normal: SIMD3<Double>) -> Float {
            let keyed = max(0, dot(normal, keyDirection)) * keyStrength
            let filled = max(0, dot(normal, fillDirection)) * fillStrength
            return Float(base + keyed + filled)
        }

        self.roof = factor(SIMD3(0, 0, 1))
        self.nearX = factor(SIMD3(-1, 0, 0))
        self.nearY = factor(SIMD3(0, -1, 0))
        self.contactFoot = Float(feet.contact)
        let plan = Self.plan(of: key)
        self.keyPlan = SIMD2<Float>(Float(plan.x), Float(plan.y))
        self.sheenFoot = Float(feet.sheen)
    }

    /// One lamp's direction across the plan alone, normalised — or nothing where the lamp is
    /// straight overhead and has no plan direction to give.
    ///
    /// The one declaration of it: the sheen runs along it and every cast shadow is thrown against
    /// it, and two copies of a normalise are two chances for a roof to be bright on the side its
    /// own shadow falls.
    static func plan(of lamp: ArgoLight.Lamp) -> SIMD2<Double> {
        let plan = SIMD2(lamp.direction.x, lamp.direction.y)
        let length = (plan.x * plan.x + plan.y * plan.y).squareRoot()
        return length > 0 ? plan / length : .zero
    }

    /// The one lighting the Atlas ever draws — the contract's own lamps, solved once rather than
    /// per frame: nothing here depends on the camera, so there is nothing a turn could invalidate.
    static let city = AtlasLighting(
        ambient: ArgoLight.ambient, key: ArgoLight.key, fill: ArgoLight.fill,
        feet: (contact: ArgoLight.contactFoot, sheen: ArgoLight.sheenFoot),
    )

    private static func normalized(_ vector: SIMD3<Double>) -> SIMD3<Double> {
        let length = (vector.x * vector.x + vector.y * vector.y + vector.z * vector.z).squareRoot()
        return length > 0 ? vector / length : vector
    }

    /// How hard one lamp drives, all of it: its intensity through its own tint. The one place a
    /// lamp becomes a number, so the city's faces (above) and the orbit ball
    /// (`AtlasOrbitShading`) cannot disagree about what the same lamp is worth.
    static func strength(of lamp: ArgoLight.Lamp) -> Double {
        lamp.intensity * tone(lamp.tint)
    }

    /// A lamp's own colour, spent as the one number a direction and a strength cannot carry
    /// between them: how bright the lamp reads, independent of which channel it leans on.
    /// `ArgoColor.rec709Weights` — the same three numbers `relativeLuminance` reads — but without
    /// its gamma curve: a lamp's tint is a plain multiplier here, not a displayed colour to
    /// linearise.
    static func tone(_ tint: ArgoColor) -> Double {
        ArgoColor.rec709Weights.red * tint.red
            + ArgoColor.rec709Weights.green * tint.green
            + ArgoColor.rec709Weights.blue * tint.blue
    }
}
