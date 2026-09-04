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
    /// The other — the one the fill lifts, key-dark otherwise.
    var nearY: Float
    /// The wall's own foot term, carried alongside rather than folded into `nearX`/`nearY`: it is
    /// a SECOND scalar, read along the wall's own height rather than picked by its face.
    var contactFoot: Float

    /// Solved from the contract's own lamps. An ambient term has no direction, so it lights every
    /// face alike and is folded into all three before either directional lamp is added.
    init(ambient: ArgoLight.Lamp, key: ArgoLight.Lamp, fill: ArgoLight.Lamp, contactFoot: Double) {
        let base = ambient.intensity * Self.luminance(ambient.tint)
        let keyDirection = Self.normalized(key.direction)
        let fillDirection = Self.normalized(fill.direction)
        let keyStrength = key.intensity * Self.luminance(key.tint)
        let fillStrength = fill.intensity * Self.luminance(fill.tint)

        func factor(_ normal: SIMD3<Double>) -> Float {
            let keyed = max(0, dot(normal, keyDirection)) * keyStrength
            let filled = max(0, dot(normal, fillDirection)) * fillStrength
            return Float(base + keyed + filled)
        }

        self.roof = factor(SIMD3(0, 0, 1))
        self.nearX = factor(SIMD3(-1, 0, 0))
        self.nearY = factor(SIMD3(0, -1, 0))
        self.contactFoot = Float(contactFoot)
    }

    /// The one lighting the Atlas ever draws — the contract's own lamps, solved once rather than
    /// per frame: nothing here depends on the camera, so there is nothing a turn could invalidate.
    static let city = AtlasLighting(
        ambient: ArgoLight.ambient, key: ArgoLight.key, fill: ArgoLight.fill,
        contactFoot: ArgoLight.contactFoot,
    )

    private static func normalized(_ vector: SIMD3<Double>) -> SIMD3<Double> {
        let length = (vector.x * vector.x + vector.y * vector.y + vector.z * vector.z).squareRoot()
        return length > 0 ? vector / length : vector
    }

    /// A lamp's own colour, spent as the one number a direction and a strength cannot carry
    /// between them: how bright the lamp reads, independent of which channel it leans on.
    /// `ArgoColor.rec709Weights` — the same three numbers `relativeLuminance` reads — but without
    /// its gamma curve: a lamp's tint is a plain multiplier here, not a displayed colour to
    /// linearise.
    private static func luminance(_ tint: ArgoColor) -> Double {
        ArgoColor.rec709Weights.red * tint.red
            + ArgoColor.rec709Weights.green * tint.green
            + ArgoColor.rec709Weights.blue * tint.blue
    }
}
