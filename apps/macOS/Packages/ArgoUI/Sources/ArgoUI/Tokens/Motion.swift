import SwiftUI

/// Timing, glow and depth. `pulse` is the period a status dot breathes at — a property of
/// the STATE (live, or asking), not a budget handed to one element. The rationed animation
/// is the attention sweep, which only a row asking for you ever gets.
public enum Motion {
    public static let fast: Duration = .milliseconds(150)
    public static let slow: Duration = .milliseconds(300)
    public static let pulse: Duration = .seconds(2)
    /// The opacity a pulsing dot dips to.
    public static let pulseDim: Double = 0.45

    public static let ease = UnitCurve.bezier(
        startControlPoint: UnitPoint(x: 0.4, y: 0),
        endControlPoint: UnitPoint(x: 0.2, y: 1),
    )

    // MARK: - Glow

    /// The lit halo a status signal carries. Its colour is the element's own tone, so one
    /// treatment covers every state and only the STRENGTH is themed.
    ///
    /// Every state glows, and the weight is the state's liveness: `live` burns at the base
    /// strength, `quiet` (a state at rest — idle, landed) at a fraction of it, `faint` at the
    /// least, the hollow ring of a session Argo only observes. A failure keeps `live`: it
    /// burns as bright as needs-you, it just does not breathe.
    public static let glowStrength: Double = 0.60
    public static let glowStrengthQuiet = glowStrength * 0.4
    public static let glowStrengthFaint = glowStrength * 0.22
    public static let glowBlur: CGFloat = 8
    public static let glowBlurQuiet = glowBlur * 0.75
    public static let glowBlurFaint = glowBlur * 0.5

    // MARK: - The attention sweep

    /// A faint ray of light travelling the ring of the one row asking for you. `base` is the
    /// always-on ring, so the edge never drops out behind the ray; `still` is the whole ring
    /// under reduced motion. The ray's body is deliberately long: an angle crosses a row's
    /// long edges and its short ones at different speeds, and a long soft body is what keeps
    /// that from reading as a stutter.
    public static let sweepRing: CGFloat = 1.5
    public static let sweepPeriod: Duration = .milliseconds(2400)
    public static let sweepRay: Double = 0.30
    public static let sweepTail: Double = 0.10
    public static let sweepBase: Double = 0.07
    public static let sweepStill: Double = 0.12

    // MARK: - Depth

    /// How far a dormant plane recedes behind the driven one. Two steps only (the scene never
    /// stacks deeper than second-back), and BRIGHTNESS only: scaling and shifting each step
    /// reads at cockpit width as cards of inconsistent size rather than as depth. Attention
    /// is brightness, and that is enough.
    public static let recedeFirst: Double = 0.66
    public static let recedeSecond: Double = 0.50

    // MARK: - Glass

    /// One frosted surface per region. A second blurred layer inside the first is the mistake
    /// this pair of numbers exists to make expensive to reach for.
    public static let frostRadius: CGFloat = 14
    public static let frostSaturation: Double = 1.05
}
