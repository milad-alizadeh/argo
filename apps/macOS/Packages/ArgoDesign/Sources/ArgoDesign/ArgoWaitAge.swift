import Foundation

/// One rung of the ladder `ArgoMotion.working` cools down as the wait it reports gets older. Past
/// roughly 10s a wait stops being part of the interaction, so a Turn six minutes in must not draw
/// like one three seconds in.
///
/// It cools and never warms: `state.attention` means something needs you, and a long wait needs
/// nothing.
public struct ArgoWaitAge: Sendable, Equatable {
    /// How long the wait has to have run for this rung to take over.
    public let after: TimeInterval
    /// The loop's period here. A PERIOD and not a wait, which is why `ArgoMotion.durationCeiling`
    /// does not reach it.
    public let period: TimeInterval
    /// How brightly the ion glows here. The THREAD's glow: that is the surface the design's table
    /// was measured on, and its first rung is `ArgoElevation.bloom.opacity` exactly.
    public let glow: Double

    /// The same fall-off as a share of the first rung, for a surface whose full strength is not the
    /// thread's. The row's wash paints type rather than casting light, so taking the thread's own
    /// numbers there would dim a three-second call below what the design approved for it.
    public var cooling: Double {
        glow / ArgoWaitAge.freshest.glow
    }

    /// The loop at this rung — the role's own curve and Reduce Motion answer, over this period. It
    /// still stops for Reduce Motion, because an aged wait has no still of its own.
    public var motion: ArgoMotion {
        ArgoMotion.working.over(period)
    }
}

public extension ArgoWaitAge {
    /// The ladder, youngest first. The first rung is what `ArgoMotion.working` and
    /// `ArgoElevation.bloom` already say, so a short wait draws exactly as it did.
    static let all: [ArgoWaitAge] = [
        ArgoWaitAge(after: 0, period: 1.2, glow: 0.60),
        ArgoWaitAge(after: 10, period: 1.8, glow: 0.49),
        ArgoWaitAge(after: 60, period: 2.4, glow: 0.40),
        ArgoWaitAge(after: 300, period: 3.1, glow: 0.30),
    ]

    /// The rung a wait of this age reads at. The threshold belongs to the COLDER rung, and an age
    /// below the ladder reads as `freshest`: a clock that has not started must not draw a wait
    /// colder than a fresh one.
    static func rung(at age: TimeInterval) -> ArgoWaitAge {
        all.last { age >= $0.after } ?? freshest
    }

    /// Where a wait starts.
    static var freshest: ArgoWaitAge {
        all[0]
    }

    /// Where a wait ends up and stays. The ladder has a floor on purpose: a pass slow enough to
    /// stop reading as travel would say the Turn had stopped. No surface reads it: the ladder's
    /// two ends are what `ContractSpecimen` states the cooling as.
    static var coldest: ArgoWaitAge {
        rung(at: .infinity)
    }
}
