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
        /// The lamp's own colour, spent as a per-channel multiplier on the pigment it lands on.
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

    /// Every lamp, for the contract sheet.
    public static let all: [(name: String, lamp: Lamp)] = [
        ("key", key), ("fill", fill), ("ambient", ambient),
    ]

    /// The two scalars, which are not lamps and are drawn as what they do to a pigment.
    public static let shades: [(name: String, value: Double)] = [
        ("planShade", planShade), ("orbDim", orbDim),
    ]

    /// Roles nothing draws yet. The whole family waits on the Metal renderer; it is declared here
    /// because this is where it was decided, and because the ticket that writes the shader may not
    /// re-derive a number it can read (see `ArgoMotion.unwired` for why an unwired role stays and
    /// why it says so).
    public static let unwired: [String: String] = [
        "key": "the Metal renderer", "fill": "the Metal renderer",
        "ambient": "the Metal renderer",
    ]
}
