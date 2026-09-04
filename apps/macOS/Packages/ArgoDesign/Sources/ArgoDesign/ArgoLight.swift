/// The light the map is lit by.
///
/// `ArgoElevation` is deliberately anti-3D — four of its six rungs are all-zero, because depth in
/// the cockpit comes from tone and edge and never from a shadow. This family is the exception, and
/// it exists because the Atlas has a Metal shader and a shader needs numbers. These are that
/// shader's uniforms, written down where they were decided.
///
/// **The rule attached is absolute**: every term here is a scalar multiply on a band's own
/// pigment — `ArgoColor.scaled(by:)` — never a hue shift and never a wash toward white. A lit roof
/// is the same colour as its legend swatch, only darker or brighter. `ArgoLightTests` asserts it
/// over the bands themselves.
///
/// Not on `ArgoPalette` for the reason `ArgoMotion` and `ArgoElevation` are not: a lamp is not an
/// appearance. A light palette would relight nothing.
public enum ArgoLight {
    /// One lamp: where it shines from, what colour it is, and how hard.
    public struct Lamp: Sendable {
        /// Which way the light travels from, in the map's own space. The shader normalises it —
        /// what is written here is a direction, not a unit vector.
        public let direction: SIMD3<Double>
        /// The lamp's own colour. Spent as its LUMINANCE — one number, not three — because the
        /// rule above is absolute: a per-channel multiply on the pigment would be the hue shift
        /// the rule forbids the moment the tint and the pigment disagree on a channel.
        public let tint: ArgoColor
        /// How hard it is driven.
        public let intensity: Double

        public init(direction: SIMD3<Double>, tint: ArgoColor, intensity: Double) {
            self.direction = direction
            self.tint = tint
            self.intensity = intensity
        }
    }

    /// The warm key: the lamp a face is read by.
    public static let key = Lamp(
        direction: SIMD3(-0.66, 0.36, 0.66),
        tint: ArgoColor(red: 1.00, green: 0.93, blue: 0.82),
        intensity: 1.14,
    )

    /// The cool fill, opposite the key. It lifts the dark side rather than competing with it —
    /// a third of the key's strength, or the map grows a second set of highlights.
    public static let fill = Lamp(
        direction: SIMD3(0.58, -0.36, 0.30),
        tint: ArgoColor(red: 0.58, green: 0.76, blue: 1.00),
        intensity: 0.32,
    )

    /// The sky term: light from everywhere, cool because the fill is. It has no direction, and its
    /// colour IS its strength — there is no second number to drive it with.
    public static let ambient = Lamp(
        direction: .zero,
        tint: ArgoColor(red: 0.30, green: 0.34, blue: 0.39),
        intensity: 1,
    )

    /// The flat view's single shade, and the ambient-occlusion floor. Straight down at the treemap
    /// there are no faces to tell apart, so there is one shade rather than three.
    public static let planShade = 0.85

    /// The orbit widget is the same model, turned down: it sits beside the map rather than being
    /// it, and a control lit as hard as its subject competes with it.
    public static let orbDim = 0.74

    /// How much of a wall's own light survives at its foot, where everything standing around it
    /// blocks the sky and the fill both: a wall takes its full share of the light near the roof
    /// and keeps only this fraction at the ground, which is what a reader calls a contact shadow.
    /// A scalar like every other term here, so the gradient it draws never turns a wall's hue —
    /// only how dark the same colour gets nearer the floor.
    public static let contactFoot = 0.44

    /// The share of the tallest file's own height a file has to clear before it casts anything —
    /// short enough not to bother, in the same units `AtlasElevation.ceiling(of:)` scales heights
    /// in. Below it a shadow would be a smudge on the plate with nothing worth casting one.
    public static let shadowFloorShare = 4.0 / 150

    /// The share at which a shadow reaches its full strength, past `shadowFloorShare`. The span
    /// between the two is where the shadow ramps from nothing to `shadowDepth`.
    public static let shadowFullShare = 38.0 / 150

    /// How far a shadow is pushed across the plan, as a multiple of the caster's own height. Real
    /// sunlight at this pitch would throw a shadow longer than the plate it lands on and read as
    /// somebody else's, so the throw is compressed — the same compression for every box.
    public static let shadowSlope = 0.40

    /// What a fully-shadowed patch of plate is left at, at full strength — the shadow's own
    /// `contactFoot`. Never zero: a shadow that reached black would be a second ground colour the
    /// legend does not name.
    public static let shadowDepth = 0.45

    /// How far a fully-lit roof may drift from its own legend swatch, in `ArgoColor.distance(to:)`
    /// units — the key's own intensity is driven above one on purpose, so the city's roof reads
    /// brighter than the swatch beside it, not merely darker. The legend stays one fixed reading
    /// across both cameras rather than tracking `relief`, so this bounds how far apart the two are
    /// ever allowed to read rather than asking them to match exactly. `AtlasLightingTests` is what
    /// spends it.
    public static let legendTolerance = 0.15

    /// Every lamp, for the contract sheet.
    public static let all: [(name: String, lamp: Lamp)] = [
        ("key", key), ("fill", fill), ("ambient", ambient),
    ]

    /// The scalars that are not lamps, and are drawn as what they do to a pigment.
    public static let shades: [(name: String, value: Double)] = [
        ("planShade", planShade), ("orbDim", orbDim),
        ("contactFoot", contactFoot), ("shadowDepth", shadowDepth),
    ]
}
